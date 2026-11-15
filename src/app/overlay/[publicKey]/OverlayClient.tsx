"use client";

import React, { useEffect, useRef, useState } from "react";
import { OverlayHudCanvas } from "@/components/hud/OverlayHudCanvas";
import type { OverlayStateSnapshot } from "@/lib/types";

interface OverlayClientProps {
  initialState: OverlayStateSnapshot;
}

export function OverlayClient({ initialState }: OverlayClientProps) {
  const [state, setState] = useState<OverlayStateSnapshot>(initialState);
  const versionRef = useRef<number>(initialState.stateVersion);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.background = "transparent";
    document.body.style.backgroundColor = "transparent";
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
  }, []);

  useEffect(() => {
    const publicKey = initialState.publicKey;
    let closed = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const applySnapshot = (next: OverlayStateSnapshot) => {
      if (next.stateVersion >= versionRef.current) {
        versionRef.current = next.stateVersion;
        setState(next);
      }
    };

    const connectSse = () => {
      if (closed) return;
      source = new EventSource(`/api/stream/${encodeURIComponent(publicKey)}`);
      source.addEventListener("state", (evt) => {
        try {
          const parsed = JSON.parse(
            (evt as MessageEvent<string>).data
          ) as OverlayStateSnapshot;
          applySnapshot(parsed);
        } catch {
          // Ignore malformed event
        }
      });
      source.onerror = () => {
        source?.close();
        source = null;
        if (!closed) {
          reconnectTimer = setTimeout(connectSse, 1500);
        }
      };
    };

    connectSse();

    // Resilient 1.5-second fallback poll so OBS never disconnects during 12-hour streams
    const fallbackPollId = setInterval(async () => {
      if (closed) return;
      try {
        const res = await fetch(
          `/api/overlay/state/${encodeURIComponent(publicKey)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const next = (await res.json()) as OverlayStateSnapshot;
        if (next.stateVersion > versionRef.current) {
          applySnapshot(next);
        }
      } catch {
        // Retry on next tick
      }
    }, 1500);

    return () => {
      closed = true;
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(fallbackPollId);
    };
  }, [initialState.publicKey]);

  return <OverlayHudCanvas state={state} mode="obs" />;
}
