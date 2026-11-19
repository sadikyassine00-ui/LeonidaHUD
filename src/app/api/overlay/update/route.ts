import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/session";
import {
  regenerateSecretKeyForUser,
  updateOverlayForUser,
  type OverlayUpdatePatch,
} from "@/lib/overlay-service";

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

  if (body.action === "regenerate_secret") {
    const secretTriggerKey = await regenerateSecretKeyForUser(userId);
    if (!secretTriggerKey) {
      return Response.json({ error: "Overlay not found" }, { status: 404 });
    }
    return Response.json({ ok: true, secretTriggerKey });
  }

  const patch: OverlayUpdatePatch = {};

  if (typeof body.wastedDelta === "number") patch.wastedDelta = body.wastedDelta;
  if (typeof body.bustedDelta === "number") patch.bustedDelta = body.bustedDelta;
  if (typeof body.wastedCount === "number") patch.wastedCount = body.wastedCount;
  if (typeof body.bustedCount === "number") patch.bustedCount = body.bustedCount;
  if (typeof body.cashDelta === "number") patch.cashDelta = body.cashDelta;
  if (typeof body.cashBalance === "number") patch.cashBalance = body.cashBalance;
  if (typeof body.toggleMissionId === "string")
    patch.toggleMissionId = body.toggleMissionId;
  if (Array.isArray(body.completedMissionIds)) {
    patch.completedMissionIds = body.completedMissionIds.filter(
      (id): id is string => typeof id === "string"
    );
  }
  if (
    body.addCustomMission &&
    typeof body.addCustomMission === "object" &&
    body.addCustomMission !== null
  ) {
    const m = body.addCustomMission as Record<string, unknown>;
    if (typeof m.title === "string" && m.title.trim()) {
      const chNum =
        typeof m.chapterNumber === "number"
          ? Math.max(1, Math.min(6, Math.floor(m.chapterNumber)))
          : 1;
      patch.addCustomMission = {
        chapterNumber: chNum,
        chapterTitle:
          typeof m.chapterTitle === "string" && m.chapterTitle.trim()
            ? m.chapterTitle.trim()
            : `Chapter ${chNum}: Custom Operations`,
        title: m.title.trim().slice(0, 80),
        region:
          typeof m.region === "string" && m.region.trim()
            ? m.region.trim().slice(0, 40)
            : "Leonida",
      };
    }
  }
  if (
    body.theme === "sunset-broadcast" ||
    body.theme === "minimal-glass" ||
    body.theme === "tactical-dark"
  ) {
    patch.theme = body.theme;
  }
  if (body.twitchChannel !== undefined) {
    patch.twitchChannel =
      typeof body.twitchChannel === "string" ? body.twitchChannel : null;
  }
  if (body.kickChannel !== undefined) {
    patch.kickChannel =
      typeof body.kickChannel === "string" ? body.kickChannel : null;
  }
  if (typeof body.showStoryWidget === "boolean")
    patch.showStoryWidget = body.showStoryWidget;
  if (typeof body.showDeathWidget === "boolean")
    patch.showDeathWidget = body.showDeathWidget;
  if (typeof body.showCashWidget === "boolean")
    patch.showCashWidget = body.showCashWidget;
  if (typeof body.showPollWidget === "boolean")
    patch.showPollWidget = body.showPollWidget;
  if (typeof body.clipSafeMode === "boolean")
    patch.clipSafeMode = body.clipSafeMode;
  if (body.hookBanner !== undefined) {
    patch.hookBanner =
      typeof body.hookBanner === "string"
        ? body.hookBanner.trim().slice(0, 80) || null
        : null;
  }

  const updated = await updateOverlayForUser(userId, patch);
  if (!updated) {
    return Response.json({ error: "Overlay not found" }, { status: 404 });
  }

  return Response.json({ ok: true, overlay: updated });
}
