import { notFound } from "next/navigation";
import { getOverlayByPublicKey } from "@/lib/overlay-service";
import { OverlayClient } from "./OverlayClient";

export const dynamic = "force-dynamic";

export default async function OverlayPage(props: {
  params: Promise<{ publicKey: string }>;
  searchParams: Promise<{ clip?: string; clipSafe?: string }>;
}) {
  const [{ publicKey }, { clip, clipSafe }] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  const overlay = await getOverlayByPublicKey(publicKey);

  if (!overlay) {
    notFound();
  }

  const forceClipSafe =
    clip === "9:16" || clipSafe === "1" || clipSafe === "true";

  return <OverlayClient initialState={overlay} forceClipSafe={forceClipSafe} />;
}
