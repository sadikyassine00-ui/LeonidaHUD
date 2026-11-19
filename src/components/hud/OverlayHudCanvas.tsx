"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { HudTheme, OverlayStateSnapshot } from "@/lib/types";

interface OverlayHudCanvasProps {
  state: OverlayStateSnapshot;
  mode?: "obs" | "preview";
  forceClipSafe?: boolean;
}

interface ThemeTokens {
  plate: string;
  accentBar: string;
  chapterText: string;
  labelText: string;
  valueText: string;
  segmentActive: string;
  segmentTrack: string;
  pollBarA: string;
  pollBarB: string;
}

function getThemeTokens(theme: HudTheme): ThemeTokens {
  switch (theme) {
    case "minimal-glass":
      return {
        plate:
          "bg-[#131720]/70 backdrop-blur-md border border-white/15 shadow-[0_12px_32px_rgba(11,13,18,0.45)]",
        accentBar: "bg-[#F4F5F7]/80",
        chapterText: "text-[#F4F5F7]",
        labelText: "text-[#8D96A5]",
        valueText: "text-[#F4F5F7]",
        segmentActive: "bg-[#F4F5F7]",
        segmentTrack: "bg-white/10",
        pollBarA: "bg-[#F25C54]",
        pollBarB: "bg-[#2EC4B6]",
      };
    case "tactical-dark":
      return {
        plate:
          "bg-[#0B0D12]/92 backdrop-blur-sm border border-[#F7B267]/25 shadow-[0_16px_40px_rgba(11,13,18,0.65)]",
        accentBar: "bg-[#F7B267]",
        chapterText: "text-[#F7B267]",
        labelText: "text-[#8D96A5]",
        valueText: "text-[#F4F5F7]",
        segmentActive: "bg-[#F7B267]",
        segmentTrack: "bg-[#1C2230]",
        pollBarA: "bg-[#F7B267]",
        pollBarB: "bg-[#F25C54]",
      };
    case "sunset-broadcast":
    default:
      return {
        plate:
          "bg-[#131720]/88 backdrop-blur-md border border-white/10 shadow-[0_16px_40px_rgba(11,13,18,0.55)]",
        accentBar: "bg-gradient-to-b from-[#F25C54] to-[#F7B267]",
        chapterText: "text-[#F7B267]",
        labelText: "text-[#8D96A5]",
        valueText: "text-[#F4F5F7]",
        segmentActive: "bg-gradient-to-r from-[#F25C54] to-[#F7B267]",
        segmentTrack: "bg-white/10",
        pollBarA: "bg-[#F25C54]",
        pollBarB: "bg-[#F7B267]",
      };
  }
}

function SkullIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M12 3C7.58 3 4 6.36 4 10.5C4 13.06 5.36 15.32 7.45 16.66V19.5C7.45 20.33 8.12 21 8.95 21H15.05C15.88 21 16.55 20.33 16.55 19.5V16.66C18.64 15.32 20 13.06 20 10.5C20 6.36 16.42 3 12 3Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="10.8" r="1.55" fill="currentColor" />
      <circle cx="14.8" cy="10.8" r="1.55" fill="currentColor" />
      <path
        d="M10.2 17.5V21M13.8 17.5V21M12 14.2L11.1 15.6H12.9L12 14.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HandcuffIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle
        cx="7"
        cy="15.5"
        r="4"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <circle
        cx="17"
        cy="15.5"
        r="4"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M9.6 12.2L11.2 9.5H12.8L14.4 12.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.8 7.5H13.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatCash(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return "$" + safe.toLocaleString("en-US");
}

function formatCountdown(endsAt: string | null, nowMs: number): string {
  if (!endsAt) return "LIVE";
  const diffSec = Math.max(
    0,
    Math.ceil((new Date(endsAt).getTime() - nowMs) / 1000)
  );
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function OverlayHudCanvas({
  state,
  mode = "obs",
  forceClipSafe = false,
}: OverlayHudCanvasProps) {
  const tokens = getThemeTokens(state.theme);
  const isObs = mode === "obs";

  const prevCashRef = useRef<number>(state.cashBalance);
  const prevWastedRef = useRef<number>(state.wastedCount);
  const prevBustedRef = useRef<number>(state.bustedCount);

  const [cashFlash, setCashFlash] = useState<"up" | "down" | null>(null);
  const [wastedPulse, setWastedPulse] = useState(false);
  const [bustedPulse, setBustedPulse] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [viewport, setViewport] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    if (!isObs || typeof window === "undefined") return;
    const syncSize = () => {
      setViewport({
        width: window.innerWidth || 1920,
        height: window.innerHeight || 1080,
      });
    };
    syncSize();
    window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, [isObs]);

  useEffect(() => {
    if (state.cashBalance !== prevCashRef.current) {
      const dir = state.cashBalance > prevCashRef.current ? "up" : "down";
      prevCashRef.current = state.cashBalance;
      setCashFlash(dir);
      const t = setTimeout(() => setCashFlash(null), 900);
      return () => clearTimeout(t);
    }
  }, [state.cashBalance]);

  useEffect(() => {
    if (state.wastedCount > prevWastedRef.current) {
      setWastedPulse(true);
      const t = setTimeout(() => setWastedPulse(false), 750);
      prevWastedRef.current = state.wastedCount;
      return () => clearTimeout(t);
    }
    prevWastedRef.current = state.wastedCount;
  }, [state.wastedCount]);

  useEffect(() => {
    if (state.bustedCount > prevBustedRef.current) {
      setBustedPulse(true);
      const t = setTimeout(() => setBustedPulse(false), 750);
      prevBustedRef.current = state.bustedCount;
      return () => clearTimeout(t);
    }
    prevBustedRef.current = state.bustedCount;
  }, [state.bustedCount]);

  useEffect(() => {
    if (!state.activePoll?.isActive) return;
    const immediateId = setTimeout(() => setNowMs(Date.now()), 0);
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearTimeout(immediateId);
      clearInterval(id);
    };
  }, [state.activePoll?.isActive, state.activePoll?.id]);

  const isPortrait = isObs && viewport.height > viewport.width;
  const isClipSafe = Boolean(
    forceClipSafe || (state.plan === "pro" && state.clipSafeMode) || isPortrait
  );

  const hudScale = isObs
    ? isClipSafe
      ? Math.min(
          1.15,
          Math.max(
            0.58,
            isPortrait
              ? Math.min(viewport.width / 1080, viewport.height / 1920)
              : Math.min(viewport.height / 1080, 1)
          )
        )
      : Math.min(
          1.35,
          Math.max(
            0.55,
            Math.min(viewport.width / 1920, viewport.height / 1080)
          )
        )
    : isClipSafe
      ? 0.56
      : 0.74;

  const totalSegments = 12;
  const filledSegments = Math.round(
    (Math.min(100, Math.max(0, state.storyPercent)) / 100) * totalSegments
  );

  const poll = state.activePoll;
  const pollActive = Boolean(state.showPollWidget && poll && poll.isActive);
  const totalVotes = (poll?.votesA ?? 0) + (poll?.votesB ?? 0);
  const pctA =
    totalVotes > 0 ? Math.round(((poll?.votesA ?? 0) / totalVotes) * 100) : 50;
  const pctB = totalVotes > 0 ? 100 - pctA : 50;

  const hookBannerCard =
    isClipSafe && state.plan === "pro" && state.hookBanner ? (
      <div
        className={`w-full rounded-xl text-center ${tokens.plate}`}
        style={{
          padding:
            "calc(8px * var(--hud-scale)) calc(16px * var(--hud-scale))",
        }}
      >
        <div
          className={`font-hud font-extrabold uppercase tracking-wider truncate ${tokens.chapterText}`}
          style={{ fontSize: "calc(18px * var(--hud-scale))" }}
        >
          {state.hookBanner}
        </div>
      </div>
    ) : null;

  const storyCard = (
    <AnimatePresence>
      {state.showStoryWidget && (
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className={`rounded-xl ${
            isClipSafe ? "w-full" : "w-full max-w-[calc(420px*var(--hud-scale))]"
          } ${tokens.plate}`}
          style={{
            padding:
              "calc(14px * var(--hud-scale)) calc(18px * var(--hud-scale))",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`rounded-full shrink-0 ${tokens.accentBar}`}
                style={{
                  width: "calc(4px * var(--hud-scale))",
                  height: "calc(34px * var(--hud-scale))",
                }}
              />
              <div className="min-w-0">
                <div
                  className={`uppercase tracking-[0.14em] font-bold ${tokens.labelText}`}
                  style={{ fontSize: "calc(11px * var(--hud-scale))" }}
                >
                  STORY PROGRESS
                </div>
                <div
                  className={`font-semibold truncate ${tokens.chapterText}`}
                  style={{ fontSize: "calc(16px * var(--hud-scale))" }}
                >
                  {state.storyChapter}
                </div>
              </div>
            </div>
            <div
              className={`font-hud font-extrabold leading-none shrink-0 ${tokens.valueText}`}
              style={{ fontSize: "calc(34px * var(--hud-scale))" }}
            >
              {state.storyPercent}%
            </div>
          </div>

          <div
            className="grid grid-cols-12 gap-1"
            style={{ marginTop: "calc(10px * var(--hud-scale))" }}
          >
            {Array.from({ length: totalSegments }).map((_, idx) => {
              const active = idx < filledSegments;
              return (
                <div
                  key={idx}
                  className={`rounded-sm overflow-hidden ${tokens.segmentTrack}`}
                  style={{ height: "calc(7px * var(--hud-scale))" }}
                >
                  {active && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.25, delay: idx * 0.02 }}
                      style={{ transformOrigin: "left" }}
                      className={`w-full h-full ${tokens.segmentActive}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const cashCard = (
    <AnimatePresence>
      {state.showCashWidget && (
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className={`rounded-xl shrink-0 ${
            isClipSafe ? "w-full flex items-center justify-between" : "text-right"
          } ${tokens.plate}`}
          style={{
            padding:
              "calc(12px * var(--hud-scale)) calc(20px * var(--hud-scale))",
          }}
        >
          <div
            className={`uppercase tracking-[0.14em] font-bold ${tokens.labelText}`}
            style={{ fontSize: "calc(11px * var(--hud-scale))" }}
          >
            NET WORTH
          </div>
          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={state.cashBalance}
                initial={{
                  y: cashFlash === "down" ? -16 : 16,
                  opacity: 0,
                }}
                animate={{ y: 0, opacity: 1 }}
                exit={{
                  y: cashFlash === "down" ? 16 : -16,
                  opacity: 0,
                }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className={`font-hud font-extrabold leading-none tracking-tight transition-colors duration-300 ${
                  cashFlash === "down" ? "text-[#F25C54]" : "text-[#2EC4B6]"
                }`}
                style={{ fontSize: "calc(42px * var(--hud-scale))" }}
              >
                {formatCash(state.cashBalance)}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const deathCard = (
    <AnimatePresence>
      {state.showDeathWidget && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className={`flex items-center rounded-xl shrink-0 ${
            isClipSafe ? "w-full justify-around" : ""
          } ${tokens.plate}`}
          style={{
            gap: "calc(20px * var(--hud-scale))",
            padding:
              "calc(14px * var(--hud-scale)) calc(20px * var(--hud-scale))",
          }}
        >
          <motion.div
            animate={
              wastedPulse
                ? { scale: [1, 1.14, 1], color: "#F25C54" }
                : { scale: 1 }
            }
            transition={{ duration: 0.45 }}
            className="flex items-center gap-2.5"
          >
            <div
              className="flex items-center justify-center rounded-lg border border-[#F25C54]/30 bg-[#F25C54]/12 text-[#F25C54]"
              style={{
                width: "calc(42px * var(--hud-scale))",
                height: "calc(42px * var(--hud-scale))",
              }}
            >
              <SkullIcon
                style={{
                  width: "calc(22px * var(--hud-scale))",
                  height: "calc(22px * var(--hud-scale))",
                }}
              />
            </div>
            <div>
              <div
                className={`uppercase tracking-[0.14em] font-bold ${tokens.labelText}`}
                style={{ fontSize: "calc(11px * var(--hud-scale))" }}
              >
                WASTED
              </div>
              <div
                className={`font-hud font-extrabold leading-none transition-colors ${
                  wastedPulse ? "text-[#F25C54]" : tokens.valueText
                }`}
                style={{ fontSize: "calc(32px * var(--hud-scale))" }}
              >
                {state.wastedCount}
              </div>
            </div>
          </motion.div>

          <div
            className="w-px bg-white/10"
            style={{ height: "calc(32px * var(--hud-scale))" }}
          />

          <motion.div
            animate={
              bustedPulse
                ? { scale: [1, 1.14, 1], color: "#F25C54" }
                : { scale: 1 }
            }
            transition={{ duration: 0.45 }}
            className="flex items-center gap-2.5"
          >
            <div
              className="flex items-center justify-center rounded-lg border border-[#F7B267]/30 bg-[#F7B267]/12 text-[#F7B267]"
              style={{
                width: "calc(42px * var(--hud-scale))",
                height: "calc(42px * var(--hud-scale))",
              }}
            >
              <HandcuffIcon
                style={{
                  width: "calc(22px * var(--hud-scale))",
                  height: "calc(22px * var(--hud-scale))",
                }}
              />
            </div>
            <div>
              <div
                className={`uppercase tracking-[0.14em] font-bold ${tokens.labelText}`}
                style={{ fontSize: "calc(11px * var(--hud-scale))" }}
              >
                BUSTED
              </div>
              <div
                className={`font-hud font-extrabold leading-none transition-colors ${
                  bustedPulse ? "text-[#F25C54]" : tokens.valueText
                }`}
                style={{ fontSize: "calc(32px * var(--hud-scale))" }}
              >
                {state.bustedCount}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const pollCard = (
    <AnimatePresence>
      {pollActive && poll && (
        <motion.div
          key={poll.id}
          initial={{ opacity: 0, x: 40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 40, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className={`rounded-xl ${
            isClipSafe ? "w-full" : "w-full max-w-[calc(410px*var(--hud-scale))]"
          } ${tokens.plate}`}
          style={{
            padding:
              "calc(14px * var(--hud-scale)) calc(18px * var(--hud-scale))",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-block w-2 h-2 rounded-full bg-[#F25C54] animate-pulse shrink-0" />
              <span
                className={`font-hud font-extrabold uppercase tracking-wide truncate ${tokens.valueText}`}
                style={{ fontSize: "calc(21px * var(--hud-scale))" }}
              >
                {poll.question}
              </span>
            </div>
            <span
              className="font-hud font-bold px-2 py-0.5 rounded bg-white/8 text-[#F7B267] shrink-0"
              style={{ fontSize: "calc(15px * var(--hud-scale))" }}
            >
              {formatCountdown(poll.endsAt, nowMs)}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                <span
                  className="font-semibold truncate text-[#F4F5F7]"
                  style={{ fontSize: "calc(14px * var(--hud-scale))" }}
                >
                  <span className="font-hud font-extrabold text-[#F25C54] mr-1.5">
                    !A
                  </span>
                  {poll.optionA}
                </span>
                <span
                  className="font-hud font-bold shrink-0 text-[#F4F5F7]"
                  style={{ fontSize: "calc(16px * var(--hud-scale))" }}
                >
                  {pctA}%
                </span>
              </div>
              <div
                className="w-full rounded-full bg-white/10 overflow-hidden"
                style={{ height: "calc(9px * var(--hud-scale))" }}
              >
                <motion.div
                  animate={{ width: `${pctA}%` }}
                  transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  className={`h-full rounded-full ${tokens.pollBarA}`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                <span
                  className="font-semibold truncate text-[#F4F5F7]"
                  style={{ fontSize: "calc(14px * var(--hud-scale))" }}
                >
                  <span className="font-hud font-extrabold text-[#F7B267] mr-1.5">
                    !B
                  </span>
                  {poll.optionB}
                </span>
                <span
                  className="font-hud font-bold shrink-0 text-[#F4F5F7]"
                  style={{ fontSize: "calc(16px * var(--hud-scale))" }}
                >
                  {pctB}%
                </span>
              </div>
              <div
                className="w-full rounded-full bg-white/10 overflow-hidden"
                style={{ height: "calc(9px * var(--hud-scale))" }}
              >
                <motion.div
                  animate={{ width: `${pctB}%` }}
                  transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  className={`h-full rounded-full ${tokens.pollBarB}`}
                />
              </div>
            </div>
          </div>

          <div
            className={`flex items-center justify-between mt-2 pt-1.5 border-t border-white/8 ${tokens.labelText}`}
            style={{ fontSize: "calc(12px * var(--hud-scale))" }}
          >
            <span>Type !A or !B in chat</span>
            <span className="font-hud font-bold text-[#F4F5F7]">
              {totalVotes.toLocaleString("en-US")} VOTES
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const watermarkBadge =
    state.plan === "free" ? (
      <div
        className="rounded-full bg-[#0B0D12]/82 border border-white/12 font-hud font-bold tracking-[0.18em] text-[#F7B267] shrink-0"
        style={{
          padding:
            "calc(4px * var(--hud-scale)) calc(14px * var(--hud-scale))",
          fontSize: "calc(12px * var(--hud-scale))",
        }}
      >
        LEONIDAHUD.COM
      </div>
    ) : null;

  return (
    <div
      data-obs-overlay={isObs ? "true" : undefined}
      style={{ "--hud-scale": hudScale } as React.CSSProperties}
      className={
        isObs
          ? "fixed inset-0 w-screen h-screen overflow-hidden bg-transparent pointer-events-none select-none"
          : "relative w-full h-full overflow-hidden select-none"
      }
    >
      {isClipSafe ? (
        <div
          className={
            isObs
              ? "max-w-[min(92vw,56.25vh)] w-full mx-auto h-full flex flex-col justify-between py-[4vh] px-3"
              : "max-w-[324px] w-full mx-auto h-full flex flex-col justify-between py-4 px-2"
          }
        >
          <div className="flex flex-col items-stretch gap-2.5">
            {hookBannerCard}
            {storyCard}
            {cashCard}
          </div>

          <div className="flex flex-col items-stretch gap-2.5">
            {pollCard}
            {deathCard}
            {watermarkBadge && (
              <div className="flex justify-center">{watermarkBadge}</div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="w-full h-full flex flex-col justify-between"
          style={{
            padding: isObs ? "clamp(12px, 2.5vw, 36px)" : "20px",
          }}
        >
          {/* Top Row: Top-Left = Story Progress, Top-Right = Net Worth */}
          <div className="flex justify-between items-start gap-4 w-full">
            <div className="min-w-0 flex-1 flex justify-start">
              {storyCard}
            </div>
            <div className="min-w-0 flex justify-end">{cashCard}</div>
          </div>

          {/* Bottom Row: Bottom-Left = Wasted/Busted + Watermark, Bottom-Right = Live Poll */}
          <div className="flex justify-between items-end gap-4 w-full">
            <div className="min-w-0 flex flex-col items-start gap-2">
              {deathCard}
              {watermarkBadge}
            </div>
            <div className="min-w-0 flex-1 flex justify-end">{pollCard}</div>
          </div>
        </div>
      )}
    </div>
  );
}
