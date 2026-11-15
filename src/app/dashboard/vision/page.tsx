import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/session";
import {
  getOrCreateOverlayForUser,
  getUserBillingInfo,
} from "@/lib/overlay-service";
import { VisionSyncClient } from "@/components/vision/VisionSyncClient";

export const dynamic = "force-dynamic";

export default async function VisionPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/signin?callbackUrl=/dashboard/vision");
  }

  const [overlay, user] = await Promise.all([
    getOrCreateOverlayForUser(userId),
    getUserBillingInfo(userId),
  ]);

  if (!overlay || !user) {
    redirect("/signin");
  }

  return (
    <VisionSyncClient initialOverlay={overlay} userEmail={user.email} />
  );
}
