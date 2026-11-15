import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/session";
import { syncPollVotesForUser } from "@/lib/overlay-service";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pollId = typeof body.pollId === "string" ? body.pollId : "";
  const votesA = typeof body.votesA === "number" ? body.votesA : 0;
  const votesB = typeof body.votesB === "number" ? body.votesB : 0;

  if (!pollId) {
    return Response.json({ error: "pollId is required" }, { status: 400 });
  }

  const overlay = await syncPollVotesForUser(userId, {
    pollId,
    votesA,
    votesB,
  });

  if (!overlay) {
    return Response.json({ error: "Overlay not found" }, { status: 404 });
  }

  return Response.json({ ok: true, overlay });
}
