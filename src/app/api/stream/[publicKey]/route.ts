import { NextRequest } from "next/server";
import {
  getOverlayByPublicKey,
  getOverlayVersionByPublicKey,
} from "@/lib/overlay-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publicKey: string }> }
) {
  const { publicKey } = await context.params;
  const initial = await getOverlayByPublicKey(publicKey);

  if (!initial) {
    return Response.json({ error: "Overlay not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastVersion = initial.stateVersion;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      const sendComment = (text: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ${text}\n\n`));
      };

      // Send initial snapshot immediately
      sendEvent("state", initial);

      const pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const currentVersion = await getOverlayVersionByPublicKey(publicKey);
          if (currentVersion !== null && currentVersion !== lastVersion) {
            const latest = await getOverlayByPublicKey(publicKey);
            if (latest) {
              lastVersion = latest.stateVersion;
              sendEvent("state", latest);
            }
          }
        } catch {
          // Keep stream alive across transient poll errors
        }
      }, 250);

      const pingTimer = setInterval(() => {
        sendComment("ping");
      }, 15000);

      // Gracefully recycle SSE stream before serverless execution limits;
      // EventSource automatically reconnects within 1s.
      const maxLifetimeTimer = setTimeout(() => {
        cleanup();
      }, 55000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(pingTimer);
        clearTimeout(maxLifetimeTimer);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
