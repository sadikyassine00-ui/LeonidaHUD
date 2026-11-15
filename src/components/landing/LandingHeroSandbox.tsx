"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  DollarSign,
  RotateCcw,
  ShieldAlert,
  Skull,
  Vote,
} from "lucide-react";
import { OverlayHudCanvas } from "@/components/hud/OverlayHudCanvas";
import { DEFAULT_MISSIONS, calculateStoryProgress } from "@/data/missions";
import type { HudTheme, OverlayStateSnapshot } from "@/lib/types";

const INITIAL_SANDBOX_STATE: OverlayStateSnapshot = {
  id: "sandbox",
  userId: "sandbox",
  publicKey: "sandbox-preview",
  secretTriggerKey: "sandbox-secret",
  theme: "sunset-broadcast",
  plan: "pro",
  twitchChannel: "leonidastreamer",
  kickChannel: "leonidastreamer",
  storyChapter: "Chapter 1: Welcome to Leonida",
  storyPercent: 17,
  completedMissionIds: ["ch1-m1", "ch1-m2", "ch1-m3", "ch1-m4"],
  customMissions: [],
  wastedCount: 4,
  bustedCount: 1,
  cashBalance: 124500,
  showStoryWidget: true,
  showDeathWidget: true,
  showCashWidget: true,
  showPollWidget: true,
  stateVersion: 1,
  updatedAt: new Date().toISOString(),
  activePoll: {
    id: "sandbox-poll-1",
    question: "NEXT MOVE?",
    optionA: "Rob armored truck",
    optionB: "5-star police chase",
    votesA: 64,
    votesB: 36,
    isActive: true,
    endsAt: new Date(Date.now() + 55000).toISOString(),
    createdAt: new Date().toISOString(),
  },
};

export function LandingHeroSandbox() {
  const [state, setState] = useState<OverlayStateSnapshot>(INITIAL_SANDBOX_STATE);

  const handleWasted = () => {
    setState((prev) => ({
      ...prev,
      wastedCount: prev.wastedCount + 1,
      stateVersion: prev.stateVersion + 1,
    }));
  };

  const handleBusted = () => {
    setState((prev) => ({
      ...prev,
      bustedCount: prev.bustedCount + 1,
      stateVersion: prev.stateVersion + 1,
    }));
  };

  const handleCash = (delta: number) => {
    setState((prev) => ({
      ...prev,
      cashBalance: Math.max(0, prev.cashBalance + delta),
      stateVersion: prev.stateVersion + 1,
    }));
  };

  const handleCompleteNextMission = () => {
    setState((prev) => {
      const nextMission = DEFAULT_MISSIONS.find(
        (m) => !prev.completedMissionIds.includes(m.id)
      );
      const nextIds = nextMission
        ? [...prev.completedMissionIds, nextMission.id]
        : ["ch1-m1"];
      const { storyPercent, storyChapter } = calculateStoryProgress(nextIds);
      return {
        ...prev,
        completedMissionIds: nextIds,
        storyPercent,
        storyChapter,
        stateVersion: prev.stateVersion + 1,
      };
    });
  };

  const handleStartPoll = () => {
    setState((prev) => ({
      ...prev,
      activePoll: {
        id: "sandbox-poll-" + Date.now(),
        question: "HEIST APPROACH?",
        optionA: "Steal a jet",
        optionB: "Buy safe house",
        votesA: 18,
        votesB: 12,
        isActive: true,
        endsAt: new Date(Date.now() + 60000).toISOString(),
        createdAt: new Date().toISOString(),
      },
      stateVersion: prev.stateVersion + 1,
    }));
  };

  const handleSimulateVote = (choice: "A" | "B") => {
    setState((prev) => {
      if (!prev.activePoll || !prev.activePoll.isActive) return prev;
      return {
        ...prev,
        activePoll: {
          ...prev.activePoll,
          votesA: prev.activePoll.votesA + (choice === "A" ? 1 : 0),
          votesB: prev.activePoll.votesB + (choice === "B" ? 1 : 0),
        },
        stateVersion: prev.stateVersion + 1,
      };
    });
  };

  const handleThemeChange = (theme: HudTheme) => {
    setState((prev) => ({ ...prev, theme }));
  };

  return (
    <div className="space-y-4">
      {/* 16:9 Live Broadcast Simulation Frame */}
      <div className="relative rounded-2xl overflow-hidden border border-white/12 bg-[#0B0D12] shadow-2xl shadow-black/60">
        {/* Stylized Dusk Coastal Broadcast Feed Backdrop (Original Geometric Art) */}
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-b from-[#1D1B2A] via-[#2B202A] to-[#0B0D12]">
          {/* Warm dusk horizon glow */}
          <div
            className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 68%, rgba(242, 92, 84, 0.28) 0%, rgba(247, 178, 103, 0.14) 35%, rgba(11, 13, 18, 0) 72%)",
            }}
          />

          {/* Clean geometric coastal skyline silhouettes */}
          <svg
            viewBox="0 0 1200 675"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 w-full h-full opacity-55 pointer-events-none"
            aria-hidden="true"
          >
            <circle cx="600" cy="390" r="115" fill="#F7B267" fillOpacity="0.16" />
            <path
              d="M0 470 L90 470 L90 360 L145 360 L145 470 L185 470 L185 315 L250 315 L250 470 L310 470 L310 390 L380 390 L380 470 L450 470 L450 335 L515 335 L515 470 L680 470 L680 345 L750 345 L750 470 L815 470 L815 295 L885 295 L885 470 L945 470 L945 380 L1020 380 L1020 470 L1090 470 L1090 350 L1150 350 L1150 470 L1200 470 L1200 675 L0 675 Z"
              fill="#0B0D12"
            />
            <path
              d="M0 535 H1200"
              stroke="#F25C54"
              strokeOpacity="0.24"
              strokeWidth="2"
            />
            <path
              d="M0 585 H1200"
              stroke="#2EC4B6"
              strokeOpacity="0.16"
              strokeWidth="1.5"
            />
          </svg>

          {/* Center label showing live console capture preview */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-[#0B0D12]/65 border border-white/10 px-4 py-1.5 text-[11px] sm:text-xs font-semibold tracking-wider uppercase text-[#8D96A5] backdrop-blur-sm">
              Live PS5 / Xbox Capture Preview | Click Any Button Below
            </div>
          </div>

          {/* Actual Modular Overlay HUD Component */}
          <OverlayHudCanvas state={state} mode="preview" />
        </div>
      </div>

      {/* Interactive Remote Sandbox Bar */}
      <div className="broadcast-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
            Click Any Button Below to Watch the OBS Overlay React
          </span>
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "sunset-broadcast", label: "Sunset" },
                { id: "minimal-glass", label: "Minimal" },
                { id: "tactical-dark", label: "Tactical" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleThemeChange(t.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  state.theme === t.id
                    ? "bg-[#F7B267] text-[#0B0D12]"
                    : "bg-[#0B0D12] text-[#8D96A5] hover:text-[#F4F5F7]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={handleWasted}
            className="h-11 rounded-xl bg-[#F25C54] hover:bg-[#F25C54]/90 active:scale-[0.97] text-[#0B0D12] font-hud font-extrabold text-lg flex items-center justify-center gap-1.5 transition-all"
          >
            <Skull className="w-4 h-4" />
            <span>WASTED +1</span>
          </button>

          <button
            type="button"
            onClick={handleBusted}
            className="h-11 rounded-xl bg-[#F7B267] hover:bg-[#F7B267]/90 active:scale-[0.97] text-[#0B0D12] font-hud font-extrabold text-lg flex items-center justify-center gap-1.5 transition-all"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>BUSTED +1</span>
          </button>

          <button
            type="button"
            onClick={() => handleCash(5000)}
            className="h-11 rounded-xl bg-[#2EC4B6] hover:bg-[#2EC4B6]/90 active:scale-[0.97] text-[#0B0D12] font-hud font-extrabold text-lg flex items-center justify-center gap-1 transition-all"
          >
            <DollarSign className="w-4 h-4" />
            <span>+$5,000</span>
          </button>

          <button
            type="button"
            onClick={handleCompleteNextMission}
            className="h-11 rounded-xl bg-[#1C2230] border border-white/12 hover:border-[#F7B267]/50 active:scale-[0.97] text-[#F4F5F7] font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-[#F7B267]" />
            <span>MISSION +1</span>
          </button>

          <button
            type="button"
            onClick={handleStartPoll}
            className="h-11 rounded-xl bg-[#1C2230] border border-white/12 hover:border-[#2EC4B6]/50 active:scale-[0.97] text-[#F4F5F7] font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <Vote className="w-4 h-4 text-[#2EC4B6]" />
            <span>START POLL</span>
          </button>

          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => handleSimulateVote("A")}
              className="h-11 rounded-xl bg-[#0B0D12] border border-[#F25C54]/35 text-[#F25C54] font-hud font-extrabold text-base hover:bg-[#F25C54]/15"
              title="Simulate !A chat vote"
            >
              !A
            </button>
            <button
              type="button"
              onClick={() => handleSimulateVote("B")}
              className="h-11 rounded-xl bg-[#0B0D12] border border-[#F7B267]/35 text-[#F7B267] font-hud font-extrabold text-base hover:bg-[#F7B267]/15"
              title="Simulate !B chat vote"
            >
              !B
            </button>
            <button
              type="button"
              onClick={() => setState(INITIAL_SANDBOX_STATE)}
              className="h-11 rounded-xl bg-[#0B0D12] border border-white/10 text-[#8D96A5] hover:text-[#F4F5F7] flex items-center justify-center"
              title="Reset Sandbox"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
