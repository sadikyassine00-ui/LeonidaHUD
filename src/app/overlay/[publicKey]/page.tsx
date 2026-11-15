import { notFound } from "next/navigation";
import { getOverlayByPublicKey } from "@/lib/overlay-service";
import { OverlayClient } from "./OverlayClient";

export const dynamic = "force-dynamic";

export default async function OverlayPage(props: {
  params: Promise<{ publicKey: string }>;
}) {
  const { publicKey } = await props.params;
  const overlay = await getOverlayByPublicKey(publicKey);

  if (!overlay) {
    notFound();
  }

  return <OverlayClient initialState={overlay} />;
}
