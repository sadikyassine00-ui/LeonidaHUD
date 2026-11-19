import type { NextRequest } from "next/server";
import { consumeLastAuthErrorReason, handlers } from "@/auth";
import { ensureDatabaseSchema } from "@/db/ensure-schema";

function decorateAuthErrorRedirect(
  request: NextRequest,
  response: Response
): Response {
  const reason = consumeLastAuthErrorReason();
  const location = response.headers.get("location");
  if (!reason || !location) {
    return response;
  }

  try {
    const parsed = new URL(location, request.url);
    if (
      parsed.pathname === "/signin" &&
      parsed.searchParams.get("error") === "Configuration" &&
      !parsed.searchParams.has("reason")
    ) {
      parsed.searchParams.set("reason", reason);
      const headers = new Headers(response.headers);
      headers.set(
        "location",
        location.startsWith("/")
          ? `${parsed.pathname}${parsed.search}${parsed.hash}`
          : parsed.toString()
      );
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  } catch {
    return response;
  }

  return response;
}

export async function GET(request: NextRequest) {
  await ensureDatabaseSchema();
  consumeLastAuthErrorReason();
  const response = await handlers.GET(request);
  return decorateAuthErrorRedirect(request, response);
}

export async function POST(request: NextRequest) {
  await ensureDatabaseSchema();
  consumeLastAuthErrorReason();
  const response = await handlers.POST(request);
  return decorateAuthErrorRedirect(request, response);
}
