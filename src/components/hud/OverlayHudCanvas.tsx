"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { HudTheme, OverlayStateSnapshot } from "@/lib/types";

interface OverlayHudCanvasProps {
  state: OverlayStateSnapshot;
  mode?: "obs" | "preview";
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

function SkullIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
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

function HandcuffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
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

  return (
    <div
      data-obs-overlay={isObs ? "true" : undefined}
      className={
        isObs
          ? "relative w-[1920px] h-[1080px] overflow-hidden bg-transparent select-none pointer-events-none"
          : "relative w-full h-full min-h-[390px] sm:min-h-[480px] overflow-hidden select-none"
      }
    >
      {/* TOP-LEFT: STORY & CHAPTER PROGRESS HUD */}
      <AnimatePresence>
        {state.showStoryWidget && (
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={
              isObs
                ? `absolute top-9 left-10 w-[390px] rounded-xl px-5 py-4 ${tokens.plate}`
                : `absolute top-3 left-3 sm:top-5 sm:left-5 w-[178px] sm:w-[275px] rounded-xl px-2.5 py-2 sm:px-4 sm:py-3 ${tokens.plate}`
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-1 rounded-full shrink-0 ${
                    isObs ? "h-9" : "h-7"
                  } ${tokens.accentBar}`}
                />
                <div className="min-w-0">
                  <div
                    className={`uppercase tracking-[0.14em] font-bold ${
                      isObs ? "text-[11px]" : "text-[9px] sm:text-[10px]"
                    } ${tokens.labelText}`}
                  >
                    STORY PROGRESS
                  </div>
                  <div
                    className={`font-semibold truncate ${
                      isObs ? "text-[16px]" : "text-[11px] sm:text-[13px]"
                    } ${tokens.chapterText}`}
                  >
                    {state.storyChapter}
                  </div>
                </div>
              </div>
              <div
                className={`font-hud font-extrabold leading-none shrink-0 ${
                  isObs ? "text-[34px]" : "text-[22px] sm:text-[26px]"
                } ${tokens.valueText}`}
              >
                {state.storyPercent}%
              </div>
            </div>

            <div
              className={`grid grid-cols-12 gap-1 ${isObs ? "mt-3" : "mt-2"}`}
            >
              {Array.from({ length: totalSegments }).map((_, idx) => {
                const active = idx < filledSegments;
                return (
                  <div
                    key={idx}
                    className={`rounded-sm overflow-hidden ${
                      isObs ? "h-2" : "h-1.5"
                    } ${tokens.segmentTrack}`}
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

      {/* TOP-RIGHT: LIVE CASH / NET WORTH TICKER */}
      <AnimatePresence>
        {state.showCashWidget && (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={
              isObs
                ? `absolute top-9 right-10 rounded-xl px-6 py-3.5 text-right ${tokens.plate}`
                : `absolute top-3 right-3 sm:top-5 sm:right-5 rounded-xl px-2.5 py-2 sm:px-4 sm:py-3 text-right ${tokens.plate}`
            }
          >
            <div
              className={`uppercase tracking-[0.14em] font-bold ${
                isObs ? "text-[11px]" : "text-[9px] sm:text-[10px]"
              } ${tokens.labelText}`}
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
                    isObs ? "text-[46px]" : "text-[22px] sm:text-[34px]"
                  } ${
                    cashFlash === "down"
                      ? "text-[#F25C54]"
                      : cashFlash === "up"
                      ? "text-[#2EC4B6]"
                      : "text-[#2EC4B6]"
                  }`}
                >
                  {formatCash(state.cashBalance)}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM-LEFT: WASTED & BUSTED COUNTER */}
      <AnimatePresence>
        {state.showDeathWidget && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={
              isObs
                ? `absolute bottom-9 left-10 flex items-center gap-6 rounded-xl px-6 py-4 ${tokens.plate}`
                : `absolute bottom-[132px] left-3 sm:bottom-5 sm:left-5 flex items-center gap-2.5 sm:gap-5 rounded-xl px-3 py-2 sm:px-4 sm:py-3 ${tokens.plate}`
            }
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
                className={`flex items-center justify-center rounded-lg border border-[#F25C54]/30 bg-[#F25C54]/12 text-[#F25C54] ${
                  isObs ? "w-11 h-11" : "w-8 h-8 sm:w-9 sm:h-9"
                }`}
              >
                <SkullIcon className={isObs ? "w-6 h-6" : "w-4 h-4 sm:w-5 sm:h-5"} />
              </div>
              <div>
                <div
                  className={`uppercase tracking-[0.14em] font-bold ${
                    isObs ? "text-[11px]" : "text-[9px] sm:text-[10px]"
                  } ${tokens.labelText}`}
                >
                  WASTED
                </div>
                <div
                  className={`font-hud font-extrabold leading-none transition-colors ${
                    isObs ? "text-[34px]" : "text-[22px] sm:text-[26px]"
                  } ${wastedPulse ? "text-[#F25C54]" : tokens.valueText}`}
                >
                  {state.wastedCount}
                </div>
              </div>
            </motion.div>

            <div className="w-px h-8 bg-white/10" />

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
                className={`flex items-center justify-center rounded-lg border border-[#F7B267]/30 bg-[#F7B267]/12 text-[#F7B267] ${
                  isObs ? "w-11 h-11" : "w-8 h-8 sm:w-9 sm:h-9"
                }`}
              >
                <HandcuffIcon
                  className={isObs ? "w-6 h-6" : "w-4 h-4 sm:w-5 sm:h-5"}
                />
              </div>
              <div>
                <div
                  className={`uppercase tracking-[0.14em] font-bold ${
                    isObs ? "text-[11px]" : "text-[9px] sm:text-[10px]"
                  } ${tokens.labelText}`}
                >
                  BUSTED
                </div>
                <div
                  className={`font-hud font-extrabold leading-none transition-colors ${
                    isObs ? "text-[34px]" : "text-[22px] sm:text-[26px]"
                  } ${bustedPulse ? "text-[#F25C54]" : tokens.valueText}`}
                >
                  {state.bustedCount}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM-RIGHT: LIVE VIEWER CHAT POLL CARD */}
      <AnimatePresence>
        {pollActive && poll && (
          <motion.div
            key={poll.id}
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={
              isObs
                ? `absolute bottom-9 right-10 w-[410px] rounded-xl px-5 py-4 ${tokens.plate}`
                : `absolute bottom-3 left-3 right-3 sm:left-auto sm:bottom-5 sm:right-5 sm:w-[290px] rounded-xl px-3 py-2.5 sm:px-4 sm:py-3.5 ${tokens.plate}`
            }
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-2 h-2 rounded-full bg-[#F25C54] animate-pulse shrink-0" />
                <span
                  className={`font-hud font-extrabold uppercase tracking-wide truncate ${
                    isObs ? "text-[22px]" : "text-[14px] sm:text-[18px]"
                  } ${tokens.valueText}`}
                >
                  {poll.question}
                </span>
              </div>
              <span
                className={`font-hud font-bold px-2 py-0.5 rounded bg-white/8 text-[#F7B267] shrink-0 ${
                  isObs ? "text-[16px]" : "text-[12px] sm:text-[14px]"
                }`}
              >
                {formatCountdown(poll.endsAt, nowMs)}
              </span>
            </div>

            <div className={isObs ? "space-y-2.5" : "space-y-1.5 sm:space-y-2"}>
              {/* Option A */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1 gap-2">
                  <span
                    className={`font-semibold truncate ${
                      isObs ? "text-[14px]" : "text-[10px] sm:text-[12px]"
                    } text-[#F4F5F7]`}
                  >
                    <span className="font-hud font-extrabold text-[#F25C54] mr-1.5">
                      !A
                    </span>
                    {poll.optionA}
                  </span>
                  <span
                    className={`font-hud font-bold shrink-0 ${
                      isObs ? "text-[16px]" : "text-[11px] sm:text-[13px]"
                    } text-[#F4F5F7]`}
                  >
                    {pctA}%
                  </span>
                </div>
                <div
                  className={`w-full rounded-full bg-white/10 overflow-hidden ${
                    isObs ? "h-2.5" : "h-1.5 sm:h-2"
                  }`}
                >
                  <motion.div
                    animate={{ width: `${pctA}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                    className={`h-full rounded-full ${tokens.pollBarA}`}
                  />
                </div>
              </div>

              {/* Option B */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1 gap-2">
                  <span
                    className={`font-semibold truncate ${
                      isObs ? "text-[14px]" : "text-[10px] sm:text-[12px]"
                    } text-[#F4F5F7]`}
                  >
                    <span className="font-hud font-extrabold text-[#F7B267] mr-1.5">
                      !B
                    </span>
                    {poll.optionB}
                  </span>
                  <span
                    className={`font-hud font-bold shrink-0 ${
                      isObs ? "text-[16px]" : "text-[11px] sm:text-[13px]"
                    } text-[#F4F5F7]`}
                  >
                    {pctB}%
                  </span>
                </div>
                <div
                  className={`w-full rounded-full bg-white/10 overflow-hidden ${
                    isObs ? "h-2.5" : "h-1.5 sm:h-2"
                  }`}
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
              className={`flex items-center justify-between mt-2 pt-1.5 border-t border-white/8 ${
                isObs ? "text-[12px]" : "text-[9px] sm:text-[11px]"
              } ${tokens.labelText}`}
            >
              <span>Type !A or !B in chat</span>
              <span className="font-hud font-bold text-[#F4F5F7]">
                {totalVotes.toLocaleString("en-US")} VOTES
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FREE PLAN WATERMARK BADGE */}
      {state.plan === "free" && (
        <div
          className={
            isObs
              ? "absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-[#0B0D12]/80 border border-white/10 px-4 py-1 text-[12px] font-hud font-bold tracking-[0.18em] text-[#8D96A5]"
              : "hidden sm:block absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0B0D12]/80 border border-white/10 px-3 py-0.5 text-[10px] font-hud font-bold tracking-[0.18em] text-[#8D96A5]"
          }
        >
          LEONIDAHUD.COM
        </div>
      )}
    </div>
  );
}
