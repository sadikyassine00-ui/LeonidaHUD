"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, DollarSign, ShieldAlert, Sparkles } from "lucide-react";
import { NeonHudState } from "@/lib/neon-hud-store";
import { ViewfinderBrackets } from "./ViewfinderBrackets";
import { OdometerNumber } from "./OdometerNumber";
import { SlicedSunGauge, SunSliceCountdownArc } from "./SlicedSun";

interface FloatingChip {
  id: number;
  amount: number;
}

interface NeonOverlayCanvasProps {
  state: NeonHudState;
  backdrop?: "transparent" | "night" | "sunset";
  compactPreview?: boolean;
}

export function NeonOverlayCanvas({
  state,
  backdrop = "transparent",
  compactPreview = false,
}: NeonOverlayCanvasProps) {
  const [typedBanner, setTypedBanner] = useState(state.hookBanner);
  const [cashChips, setCashChips] = useState<FloatingChip[]>([]);
  const [stamp, setStamp] = useState<"wasted" | "busted" | null>(null);
  const [storyBurst, setStoryBurst] = useState(false);

  const prevEventIdRef = useRef<number | null>(null);
  const prevStoryRef = useRef<number>(state.storyPct);

  // Typewriter effect (25ms/char) for Top Hook Banner
  useEffect(() => {
    const target = state.hookBanner || "";
    let i = 0;
    setTypedBanner("");
    if (!target) return;
    const timer = window.setInterval(() => {
      i += 1;
      setTypedBanner(target.slice(0, i));
      if (i >= target.length) {
        window.clearInterval(timer);
      }
    }, 25);
    return () => window.clearInterval(timer);
  }, [state.hookBanner]);

  // Trigger stamps, cash chips, and 100% sunrise burst from lastEvent
  useEffect(() => {
    const ev = state.lastEvent;
    if (!ev || ev.id === prevEventIdRef.current) return;
    prevEventIdRef.current = ev.id;

    if (ev.type === "wasted" || ev.type === "busted") {
      setStamp(ev.type);
      const t = window.setTimeout(() => setStamp(null), 1250);
      return () => window.clearTimeout(t);
    }

    if (ev.type === "cash" && ev.delta) {
      const chipId = ev.id;
      setCashChips((prev) => [...prev.slice(-3), { id: chipId, amount: ev.delta! }]);
      const t = window.setTimeout(() => {
        setCashChips((prev) => prev.filter((c) => c.id !== chipId));
      }, 1150);
      return () => window.clearTimeout(t);
    }
  }, [state.lastEvent]);

  useEffect(() => {
    if (state.storyPct === 100 && prevStoryRef.current < 100) {
      setStoryBurst(true);
      const t = window.setTimeout(() => setStoryBurst(false), 1000);
      prevStoryRef.current = state.storyPct;
      return () => window.clearTimeout(t);
    }
    prevStoryRef.current = state.storyPct;
  }, [state.storyPct]);

  // Ambient glow shifts from purple (#5B1A8F) toward orange (#FFA23A) as Story % rises
  const sunriseMix = useMemo(() => {
    const pct = Math.max(0, Math.min(100, state.storyPct));
    if (pct < 50) {
      return `radial-gradient(circle at 50% 0%, rgba(91,26,143,0.28), transparent 62%)`;
    }
    if (pct < 90) {
      return `radial-gradient(circle at 50% 0%, rgba(255,61,127,0.24), transparent 62%)`;
    }
    return `radial-gradient(circle at 50% 0%, rgba(255,162,58,0.28), transparent 62%)`;
  }, [state.storyPct]);

  const sortedPollOptions = useMemo(() => {
    return [...state.poll.options].sort((a, b) => b.votes - a.votes);
  }, [state.poll.options]);

  const totalVotes = useMemo(
    () => state.poll.options.reduce((sum, o) => sum + o.votes, 0),
    [state.poll.options]
  );

  const isClipSafe = state.clipMode === "9:16";

  const bgStyle: React.CSSProperties =
    backdrop === "night"
      ? { background: "#11072B" }
      : backdrop === "sunset"
        ? {
            background:
              "linear-gradient(180deg, rgba(91,26,143,0.85) 0%, rgba(255,61,127,0.55) 55%, rgba(17,7,43,0.95) 100%)",
          }
        : { background: "transparent" };

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${
        compactPreview ? "aspect-video rounded-[20px]" : "min-h-screen"
      }`}
      style={{
        ...bgStyle,
        fontFamily: 'var(--font-inter), "Inter", system-ui, sans-serif',
      }}
    >
      {/* Subtle Story % Sunrise Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-all duration-500"
        style={{ background: sunriseMix }}
      />

      {/* WASTED / BUSTED Full-Impact Broadcast Stamp */}
      {stamp && (
        <div
          key={stamp + (state.lastEvent?.id ?? 0)}
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
        >
          <div className="relative overflow-hidden px-8 py-4 rounded-2xl bg-[#11072B]/85 border-2 border-current animate-stamp-pop"
            style={{
              color: stamp === "wasted" ? "var(--pink)" : "var(--teal)",
              boxShadow:
                stamp === "wasted"
                  ? "0 0 36px rgba(255,61,127,0.55)"
                  : "0 0 36px rgba(25,227,198,0.55)",
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 h-5 bg-white/25 blur-[2px] animate-scanline"
            />
            <div
              className="chroma-wordmark text-4xl sm:text-6xl uppercase tracking-tight"
              data-text={stamp.toUpperCase()}
            >
              <span>{stamp.toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Morphing Viewfinder Frame: 16:9 Outer vs 9:16 Centered Safe Window */}
      <div
        className={`relative mx-auto h-full transition-all duration-300 ease-out ${
          isClipSafe
            ? compactPreview
              ? "w-[36%] min-w-[190px] py-2"
              : "w-[34%] min-w-[330px] max-w-[440px] py-6"
            : "w-full p-4 sm:p-8"
        }`}
      >
        <div className="relative w-full h-full flex flex-col justify-between p-3 sm:p-5">
          <ViewfinderBrackets
            key={state.clipMode}
            size={compactPreview ? 12 : 22}
            thickness={compactPreview ? 2 : 3}
            offset={0}
          />

          {/* Top Hook Banner (shown above safe window in 9:16 mode) */}
          {isClipSafe && state.hookBanner.trim().length > 0 && (
            <div className="mb-2 mx-auto w-full max-w-sm rounded-xl bg-[#1B0B3A]/90 border border-[var(--pink)]/60 px-3 py-1.5 text-center neon-glow-pink">
              <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-[var(--text)]">
                {typedBanner}
              </span>
            </div>
          )}

          {/* Top Cluster: Story % + Cash */}
          <div
            className={`flex gap-3 ${
              isClipSafe
                ? "flex-col items-stretch"
                : "flex-row items-start justify-between"
            }`}
          >
            {/* Story % Sliced-Sun Card */}
            <div
              className={`relative rounded-[20px] bg-[#1B0B3A]/88 border border-[var(--line-muted)]/45 backdrop-blur-md flex items-center gap-3 ${
                compactPreview ? "px-2.5 py-2" : "px-4 py-3"
              }`}
              style={{
                boxShadow:
                  "inset 0 1px 0 rgba(246,242,255,0.14), 0 0 24px rgba(255,61,127,0.22)",
              }}
            >
              <SlicedSunGauge
                percent={state.storyPct}
                burst={storyBurst}
                compact={compactPreview || isClipSafe}
              />
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-dim)]">
                  Story
                </div>
                <div
                  className={`neon-display text-[var(--text)] leading-none ${
                    compactPreview ? "text-xl" : "text-3xl sm:text-4xl"
                  }`}
                >
                  <OdometerNumber value={state.storyPct} suffix="%" />
                </div>
              </div>
            </div>

            {/* Cash Ticker Card + Floating Delta Chips */}
            <div className="relative">
              <div className="pointer-events-none absolute -top-6 right-2 flex flex-col items-end gap-1 z-20">
                {cashChips.map((chip) => (
                  <span
                    key={chip.id}
                    className={`px-2 py-0.5 rounded-full text-xs font-extrabold neon-tabular animate-cash-float ${
                      chip.amount >= 0
                        ? "bg-[var(--orange)] text-[#11072B]"
                        : "bg-[var(--pink)] text-[var(--text)]"
                    }`}
                  >
                    {chip.amount >= 0
                      ? `+$${chip.amount.toLocaleString("en-US")}`
                      : `-$${Math.abs(chip.amount).toLocaleString("en-US")}`}
                  </span>
                ))}
              </div>

              <div
                className={`rounded-[20px] bg-[#1B0B3A]/88 border border-[var(--orange)]/50 backdrop-blur-md flex items-center gap-2.5 neon-glow-orange ${
                  compactPreview ? "px-3 py-2" : "px-4 py-3"
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-[var(--orange)]/15 border border-[var(--orange)]/40 flex items-center justify-center text-[var(--orange)] shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--orange)]">
                    Cash
                  </div>
                  <div
                    className={`neon-display text-[var(--text)] leading-none ${
                      compactPreview ? "text-xl" : "text-3xl sm:text-4xl"
                    }`}
                  >
                    <OdometerNumber value={state.cash} prefix="$" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Cluster: Wasted / Busted / Custom + Racing Poll */}
          <div
            className={`flex gap-3 mt-auto ${
              isClipSafe
                ? "flex-col items-stretch"
                : "flex-row items-end justify-between"
            }`}
          >
            {/* Wasted + Busted + Custom Cluster */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`rounded-[16px] bg-[#1B0B3A]/88 border border-[var(--pink)]/50 backdrop-blur-md flex items-center gap-2 neon-glow-pink ${
                  compactPreview ? "px-2.5 py-1.5" : "px-3.5 py-2.5"
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-[var(--pink)] shrink-0" />
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--pink)]">
                    Wasted
                  </div>
                  <div
                    className={`neon-display text-[var(--text)] leading-none ${
                      compactPreview ? "text-lg" : "text-2xl"
                    }`}
                  >
                    <OdometerNumber value={state.wasted} />
                  </div>
                </div>
              </div>

              <div
                className={`rounded-[16px] bg-[#1B0B3A]/88 border border-[var(--teal)]/50 backdrop-blur-md flex items-center gap-2 neon-glow-teal ${
                  compactPreview ? "px-2.5 py-1.5" : "px-3.5 py-2.5"
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-[var(--teal)] shrink-0" />
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--teal)]">
                    Busted
                  </div>
                  <div
                    className={`neon-display text-[var(--text)] leading-none ${
                      compactPreview ? "text-lg" : "text-2xl"
                    }`}
                  >
                    <OdometerNumber value={state.busted} />
                  </div>
                </div>
              </div>

              <div
                className={`rounded-[16px] bg-[#1B0B3A]/88 border border-[var(--sun-yellow)]/45 backdrop-blur-md flex items-center gap-2 neon-glow-yellow ${
                  compactPreview ? "px-2.5 py-1.5" : "px-3.5 py-2.5"
                }`}
              >
                <Sparkles className="w-4 h-4 text-[var(--sun-yellow)] shrink-0" />
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--sun-yellow)]">
                    {state.customLabel}
                  </div>
                  <div
                    className={`neon-display text-[var(--text)] leading-none ${
                      compactPreview ? "text-lg" : "text-2xl"
                    }`}
                  >
                    <OdometerNumber value={state.customCount} />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Chat Poll Card */}
            {state.poll.active && (
              <div
                className={`rounded-[20px] bg-[#1B0B3A]/90 border border-[var(--teal)]/45 backdrop-blur-md space-y-2 ${
                  compactPreview
                    ? "p-2.5 min-w-[175px]"
                    : isClipSafe
                      ? "p-3 w-full"
                      : "p-4 min-w-[270px] max-w-[320px]"
                }`}
                style={{
                  boxShadow:
                    "inset 0 1px 0 rgba(246,242,255,0.14), 0 0 24px rgba(25,227,198,0.2)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--teal)]">
                      Chat Poll (!A / !B)
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-[var(--text)] truncate">
                      {state.poll.question}
                    </div>
                  </div>
                  <SunSliceCountdownArc
                    remaining={state.poll.remainingSeconds}
                    total={state.poll.durationSeconds}
                  />
                </div>

                <div className="space-y-1.5">
                  {sortedPollOptions.map((opt, idx) => {
                    const pct =
                      totalVotes > 0
                        ? Math.round((opt.votes / totalVotes) * 100)
                        : 0;
                    const isLeader = idx === 0 && totalVotes > 0;
                    return (
                      <div
                        key={opt.id}
                        className="relative h-7 rounded-lg bg-[var(--track)]/80 overflow-hidden flex items-center justify-between px-2.5 transition-all duration-300"
                        style={{
                          boxShadow: isLeader
                            ? "0 0 14px rgba(25,227,198,0.35)"
                            : undefined,
                        }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 transition-all duration-300 ease-out"
                          style={{
                            width: `${pct}%`,
                            background: isLeader
                              ? "linear-gradient(90deg, rgba(25,227,198,0.45), rgba(255,61,127,0.55))"
                              : "rgba(120,70,170,0.45)",
                          }}
                        />
                        <span className="relative z-10 text-[11px] font-bold text-[var(--text)] truncate">
                          !{opt.id} {opt.label}
                        </span>
                        <span className="relative z-10 text-[11px] font-extrabold neon-tabular text-[var(--text)]">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
