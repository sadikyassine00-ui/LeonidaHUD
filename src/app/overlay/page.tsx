"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import "@/styles/leonida-neon.css";
import {
  DEFAULT_NEON_HUD_STATE,
  loadNeonHudState,
  NeonHudState,
  saveAndBroadcastNeonHudState,
  SYNC_CHANNEL,
} from "@/lib/neon-hud-store";
import { NeonOverlayCanvas } from "@/components/neon/NeonOverlayCanvas";

function OverlaySurfaceInner() {
  const searchParams = useSearchParams();
  const isObsClean = searchParams.get("obs") === "1";

  const [state, setState] = useState<NeonHudState>(DEFAULT_NEON_HUD_STATE);
  const [backdrop, setBackdrop] = useState<"transparent" | "night" | "sunset">(
    "transparent"
  );

  useEffect(() => {
    setState(loadNeonHudState());
    const ch = new BroadcastChannel(SYNC_CHANNEL);
    ch.onmessage = (ev) => {
      if (ev.data?.type === "STATE_SYNC" && ev.data.state) {
        setState(ev.data.state);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key) {
        setState(loadNeonHudState());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      ch.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const toggleMode = () => {
    const next: NeonHudState = {
      ...state,
      clipMode: state.clipMode === "16:9" ? "9:16" : "16:9",
    };
    setState(next);
    saveAndBroadcastNeonHudState(next);
  };

  return (
    <div
      data-obs-overlay="true"
      data-leonida-theme="neon-sunset"
      className="relative w-screen h-screen overflow-hidden"
    >
      <NeonOverlayCanvas
        state={state}
        backdrop={isObsClean ? "transparent" : backdrop}
      />

      {!isObsClean && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[#11072B]/90 border border-[#19E3C6]/50 px-3 py-1.5 backdrop-blur-md">
          <button
            type="button"
            onClick={toggleMode}
            className="px-3 h-8 rounded-full bg-[#19E3C6] text-[#11072B] text-xs font-extrabold uppercase tracking-wider"
          >
            Mode: {state.clipMode}
          </button>
          {(["transparent", "night", "sunset"] as const).map((bg) => (
            <button
              key={bg}
              type="button"
              onClick={() => setBackdrop(bg)}
              className={`px-2.5 h-8 rounded-full text-[11px] font-bold uppercase ${
                backdrop === bg
                  ? "bg-[#FF3D7F] text-[#F6F2FF]"
                  : "text-[#B9A8DA] hover:text-[#F6F2FF]"
              }`}
            >
              {bg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NeonOverlayPage() {
  return (
    <Suspense fallback={<div data-obs-overlay="true" className="w-screen h-screen" />}>
      <OverlaySurfaceInner />
    </Suspense>
  );
}
