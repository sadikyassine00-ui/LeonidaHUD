"use client";

import React, { useEffect, useRef, useState } from "react";
import { OverlayHudCanvas } from "./OverlayHudCanvas";
import type { OverlayStateSnapshot } from "@/lib/types";

interface ScaledHudPreviewProps {
  state: OverlayStateSnapshot;
  className?: string;
  backdrop?: React.ReactNode;
}

/**
 * Scales a fixed 1024x576 HUD canvas to fit any container width proportionally
 * so all 4 corner widgets stay crisp and unclipped on mobile and desktop.
 */
export function ScaledHudPreview({
  state,
  className = "",
  backdrop,
}: ScaledHudPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setScale(width / 1024);
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`aspect-video w-full overflow-hidden relative ${className}`}
    >
      {backdrop}
      <div
        className="w-[1024px] h-[576px] absolute top-0 left-0 origin-top-left pointer-events-none"
        style={{ transform: `scale(${scale})` }}
      >
        <OverlayHudCanvas state={state} mode="preview" />
      </div>
    </div>
  );
}
