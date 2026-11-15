import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/session";
import { getOrCreateOverlayForUser } from "@/lib/overlay-service";
import { RemoteConsole } from "@/components/remote/RemoteConsole";

export const dynamic = "force-dynamic";

export default async function RemotePage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/signin?callbackUrl=/remote");
  }

  const overlay = await getOrCreateOverlayForUser(userId);
  if (!overlay) {
    redirect("/signin");
  }

  return <RemoteConsole initialOverlay={overlay} />;
}
