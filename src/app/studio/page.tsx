"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Smartphone } from "lucide-react";
import "@/styles/leonida-neon.css";
import {
  DEFAULT_NEON_HUD_STATE,
  loadNeonHudState,
  NeonHudState,
  saveAndBroadcastNeonHudState,
  SYNC_CHANNEL,
} from "@/lib/neon-hud-store";
import { NeonControllerApp } from "@/components/neon/NeonControllerApp";
import { NeonOverlayCanvas } from "@/components/neon/NeonOverlayCanvas";
import { ViewfinderBrackets } from "@/components/neon/ViewfinderBrackets";

export default function NeonStudioPage() {
  const [state, setState] = useState<NeonHudState>(DEFAULT_NEON_HUD_STATE);
  const [backdrop, setBackdrop] = useState<"sunset" | "night" | "transparent">(
    "sunset"
  );

  useEffect(() => {
    setState(loadNeonHudState());
    const ch = new BroadcastChannel(SYNC_CHANNEL);
    ch.onmessage = (ev) => {
      if (ev.data?.type === "STATE_SYNC" && ev.data.state) {
        setState(ev.data.state);
      }
    };
    return () => ch.close();
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
      data-leonida-theme="neon-sunset"
      className="neon-surface min-h-screen p-4 sm:p-6"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line-muted)]/35 pb-4">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--teal)]">
              Neon Sunset · Broadcast Viewfinder
            </div>
            <h1
              className="chroma-wordmark text-3xl sm:text-4xl"
              data-text="LEONIDA HUD STUDIO"
            >
              <span>LEONIDA HUD STUDIO</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/controller"
              className="h-11 px-4 rounded-xl bg-[var(--bg-deep)] border border-[var(--teal)]/45 text-xs font-extrabold text-[var(--teal)] inline-flex items-center gap-2 hover:bg-[var(--track)] neon-focus"
            >
              <Smartphone className="w-4 h-4" />
              <span>Mobile Controller</span>
            </Link>
            <Link
              href="/overlay"
              target="_blank"
              className="h-11 px-4 rounded-xl bg-[var(--pink)] text-xs font-extrabold text-[var(--text)] inline-flex items-center gap-2 neon-glow-pink neon-focus"
            >
              <span>OBS Overlay</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Mobile Controller */}
          <div className="lg:col-span-5 max-w-md w-full mx-auto">
            <NeonControllerApp embedded />
          </div>

          {/* Live Synced OBS Overlay Preview */}
          <div className="lg:col-span-7 space-y-3">
            <div className="relative neon-card p-4 space-y-3 neon-glow-teal">
              <ViewfinderBrackets size={16} thickness={2.5} offset={8} />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--teal)]">
                  Live OBS Browser Source ({state.clipMode})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="h-9 px-3 rounded-xl bg-[var(--teal)] text-[#11072B] text-xs font-extrabold uppercase tracking-wider neon-focus"
                  >
                    Toggle {state.clipMode === "16:9" ? "9:16" : "16:9"}
                  </button>
                  {(["sunset", "night", "transparent"] as const).map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setBackdrop(bg)}
                      className={`h-9 px-2.5 rounded-xl text-[11px] font-bold uppercase border neon-focus ${
                        backdrop === bg
                          ? "bg-[var(--pink)] border-[var(--pink)] text-[var(--text)]"
                          : "bg-[var(--bg-night)] border-[var(--line-muted)]/40 text-[var(--text-dim)]"
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border border-[var(--line-muted)]/45 bg-[#0b051b]">
                <NeonOverlayCanvas state={state} backdrop={backdrop} compactPreview />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
