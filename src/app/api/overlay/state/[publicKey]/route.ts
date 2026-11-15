import { NextRequest } from "next/server";
import { getOverlayByPublicKey } from "@/lib/overlay-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ publicKey: string }> }
) {
  const { publicKey } = await context.params;
  const overlay = await getOverlayByPublicKey(publicKey);

  if (!overlay) {
    return Response.json({ error: "Overlay not found" }, { status: 404 });
  }

  return Response.json(overlay, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
