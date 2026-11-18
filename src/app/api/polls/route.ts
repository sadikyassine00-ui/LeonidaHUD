import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/session";
import {
  endOrClearPollForUser,
  getUserBillingInfo,
  startPollForUser,
} from "@/lib/overlay-service";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const billing = await getUserBillingInfo(userId);
  if (!billing || billing.plan !== "pro") {
    return Response.json(
      { error: "Pro Broadcaster plan required for Live Chat Polls." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question =
    typeof body.question === "string" && body.question.trim()
      ? body.question.trim()
      : "NEXT MOVE?";
  const optionA =
    typeof body.optionA === "string" && body.optionA.trim()
      ? body.optionA.trim()
      : "Option A";
  const optionB =
    typeof body.optionB === "string" && body.optionB.trim()
      ? body.optionB.trim()
      : "Option B";
  const durationSeconds =
    typeof body.durationSeconds === "number" ? body.durationSeconds : 60;

  const overlay = await startPollForUser(userId, {
    question,
    optionA,
    optionB,
    durationSeconds,
  });

  if (!overlay) {
    return Response.json({ error: "Overlay not found" }, { status: 404 });
  }

  return Response.json({ ok: true, overlay });
}

export async function PATCH() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overlay = await endOrClearPollForUser(userId, "end");
  if (!overlay) {
    return Response.json({ error: "Overlay not found" }, { status: 404 });
  }
  return Response.json({ ok: true, overlay });
}

export async function DELETE() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overlay = await endOrClearPollForUser(userId, "clear");
  if (!overlay) {
    return Response.json({ error: "Overlay not found" }, { status: 404 });
  }
  return Response.json({ ok: true, overlay });
}
