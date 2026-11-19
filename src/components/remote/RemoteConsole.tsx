"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DollarSign,
  ExternalLink,
  Layers,
  Radio,
  RotateCcw,
  Settings,
  ShieldAlert,
  Skull,
  Square,
  Vote,
} from "lucide-react";
import {
  startChatPollListeners,
  type ChatPollListenerHandle,
  type ChatVoteCounts,
} from "@/lib/chat-poll-listener";
import { PRESET_POLLS, type OverlayStateSnapshot } from "@/lib/types";

const OBJECTIVE_PRESETS = [
  "Main Story",
  "100% Run",
  "Side Hustles",
  "Free Roam",
];

interface RemoteConsoleProps {
  initialOverlay: OverlayStateSnapshot;
}

export function RemoteConsole({ initialOverlay }: RemoteConsoleProps) {
  const [overlay, setOverlay] = useState<OverlayStateSnapshot>(initialOverlay);
  const [customCashInput, setCustomCashInput] = useState<string>("");
  const [pollQuestion, setPollQuestion] = useState<string>("NEXT MOVE?");
  const [pollOptionA, setPollOptionA] = useState<string>("Rob armored truck");
  const [pollOptionB, setPollOptionB] = useState<string>("5-star police chase");
  const [pollDuration, setPollDuration] = useState<number>(60);
  const [activeTab, setActiveTab] = useState<"controls" | "missions" | "polls">(
    "controls"
  );
  const [storyPercentDraft, setStoryPercentDraft] = useState<number>(
    initialOverlay.storyPercent
  );
  const [chapterInput, setChapterInput] = useState<string>(
    initialOverlay.storyChapter || "Story Playthrough"
  );
  const [syncing, setSyncing] = useState<boolean>(false);
  const [chatStatus, setChatStatus] = useState<ChatVoteCounts>({
    votesA: initialOverlay.activePoll?.votesA ?? 0,
    votesB: initialOverlay.activePoll?.votesB ?? 0,
    twitchStatus: "idle",
    kickStatus: "idle",
  });

  const listenerRef = useRef<ChatPollListenerHandle | null>(null);
  const lastSyncedVotesRef = useRef<{ a: number; b: number }>({
    a: initialOverlay.activePoll?.votesA ?? 0,
    b: initialOverlay.activePoll?.votesB ?? 0,
  });

  const mutateOverlay = useCallback(
    async (
      payload: Record<string, unknown>,
      optimisticUpdater?: (prev: OverlayStateSnapshot) => OverlayStateSnapshot
    ) => {
      if (optimisticUpdater) {
        setOverlay((prev) => optimisticUpdater(prev));
      }
      setSyncing(true);
      try {
        const res = await fetch("/api/overlay/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = (await res.json()) as { overlay?: OverlayStateSnapshot };
          if (data.overlay) {
            setOverlay(data.overlay);
          }
        }
      } finally {
        setSyncing(false);
      }
    },
    []
  );

  // Automated Twitch & Kick Live Chat Poll Listener while a poll is active
  const activePollId = overlay.activePoll?.isActive ? overlay.activePoll.id : null;
  const activeVotesA = overlay.activePoll?.votesA ?? 0;
  const activeVotesB = overlay.activePoll?.votesB ?? 0;

  useEffect(() => {
    if (!activePollId) {
      listenerRef.current?.stop();
      listenerRef.current = null;
      return;
    }

    let cancelled = false;
    lastSyncedVotesRef.current = { a: activeVotesA, b: activeVotesB };

    void startChatPollListeners({
      pollId: activePollId,
      initialVotesA: activeVotesA,
      initialVotesB: activeVotesB,
      twitchChannel: overlay.twitchChannel,
      kickChannel: overlay.kickChannel,
      onStatusChange: (nextStatus) => {
        if (cancelled) return;
        setChatStatus(nextStatus);
      },
    }).then((handle) => {
      if (cancelled) {
        handle.stop();
        return;
      }
      listenerRef.current = handle;
    });

    const syncTimer = setInterval(async () => {
      if (cancelled || !listenerRef.current) return;
      const counts = listenerRef.current.getCounts();
      if (
        counts.votesA !== lastSyncedVotesRef.current.a ||
        counts.votesB !== lastSyncedVotesRef.current.b
      ) {
        lastSyncedVotesRef.current = { a: counts.votesA, b: counts.votesB };
        try {
          const res = await fetch("/api/polls/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pollId: activePollId,
              votesA: counts.votesA,
              votesB: counts.votesB,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { overlay?: OverlayStateSnapshot };
            if (data.overlay) {
              setOverlay((prev) => ({
                ...prev,
                activePoll: data.overlay?.activePoll ?? prev.activePoll,
                stateVersion: data.overlay?.stateVersion ?? prev.stateVersion,
              }));
            }
          }
        } catch {
          // Retry on next 2s batch tick
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(syncTimer);
      listenerRef.current?.stop();
      listenerRef.current = null;
    };
  }, [
    activePollId,
    overlay.twitchChannel,
    overlay.kickChannel,
    activeVotesA,
    activeVotesB,
  ]);

  const displayedChatStatus = activePollId
    ? chatStatus
    : {
        votesA: 0,
        votesB: 0,
        twitchStatus: "idle" as const,
        kickStatus: "idle" as const,
      };

  const handleStartPoll = async (input: {
    question: string;
    optionA: string;
    optionB: string;
    durationSeconds: number;
  }) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const data = (await res.json()) as { overlay?: OverlayStateSnapshot };
        if (data.overlay) setOverlay(data.overlay);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleEndOrClearPoll = async (method: "PATCH" | "DELETE") => {
    setSyncing(true);
    try {
      const res = await fetch("/api/polls", { method });
      if (res.ok) {
        const data = (await res.json()) as { overlay?: OverlayStateSnapshot };
        if (data.overlay) setOverlay(data.overlay);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSetCashExact = () => {
    const cleaned = Number(customCashInput.replace(/[^0-9-]/g, ""));
    if (!Number.isFinite(cleaned)) return;
    const nextVal = Math.max(0, Math.round(cleaned));
    setCustomCashInput("");
    void mutateOverlay({ cashBalance: nextVal }, (prev) => ({
      ...prev,
      cashBalance: nextVal,
    }));
  };

  const commitStoryPercent = (next: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    setStoryPercentDraft(clamped);
    void mutateOverlay({ storyPercent: clamped }, (prev) => ({
      ...prev,
      storyPercent: clamped,
    }));
  };

  const commitStoryChapter = (label: string) => {
    const cleaned = label.trim().slice(0, 60) || "Story Playthrough";
    setChapterInput(cleaned);
    void mutateOverlay({ storyChapter: cleaned }, (prev) => ({
      ...prev,
      storyChapter: cleaned,
    }));
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F4F5F7] flex flex-col max-w-md mx-auto border-x border-white/8">
      {/* Compact Dock / Mobile Header */}
      <header className="sticky top-0 z-20 bg-[#0B0D12]/95 backdrop-blur-md border-b border-white/8 px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Image
            src="/logos/leonida-hud-icon.png"
            alt="Leonida HUD"
            width={24}
            height={24}
            className="w-6 h-6 rounded-md shrink-0"
          />
          <span className="font-hud font-extrabold tracking-wide text-lg uppercase truncate">
            LEONIDA REMOTE
          </span>
          {syncing && (
            <span className="text-[11px] font-semibold text-[#F7B267] shrink-0">
              SYNCING
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href={`/overlay/${overlay.publicKey}`}
            target="_blank"
            className="inline-flex items-center gap-1 rounded-lg bg-[#131720] border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-[#F4F5F7] hover:border-[#F25C54]/50 transition-colors"
            title="Open OBS Overlay Preview"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#F7B267]" />
            <span>HUD</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-[#131720] border border-white/10 p-1.5 text-[#8D96A5] hover:text-[#F4F5F7] transition-colors"
            title="Dashboard Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Live Telemetry Strip */}
      <div className="grid grid-cols-4 gap-1.5 px-3 py-2.5 bg-[#131720]/70 border-b border-white/8">
        <div className="rounded-lg bg-[#0B0D12] border border-white/6 px-2 py-1.5 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8D96A5]">
            WASTED
          </div>
          <div className="font-hud font-extrabold text-xl text-[#F25C54]">
            {overlay.wastedCount}
          </div>
        </div>
        <div className="rounded-lg bg-[#0B0D12] border border-white/6 px-2 py-1.5 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8D96A5]">
            BUSTED
          </div>
          <div className="font-hud font-extrabold text-xl text-[#F7B267]">
            {overlay.bustedCount}
          </div>
        </div>
        <div className="rounded-lg bg-[#0B0D12] border border-white/6 px-2 py-1.5 text-center col-span-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8D96A5]">
            STORY
          </div>
          <div className="font-hud font-extrabold text-xl text-[#F4F5F7]">
            {overlay.storyPercent}%
          </div>
        </div>
        <div className="rounded-lg bg-[#0B0D12] border border-white/6 px-2 py-1.5 text-center overflow-hidden">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8D96A5]">
            CASH
          </div>
          <div className="font-hud font-extrabold text-lg text-[#2EC4B6] truncate">
            ${overlay.cashBalance.toLocaleString("en-US")}
          </div>
        </div>
      </div>

      {/* Thumb Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1 p-2 bg-[#0B0D12] border-b border-white/8">
        <button
          type="button"
          onClick={() => setActiveTab("controls")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === "controls"
              ? "bg-[#F25C54] text-[#0B0D12]"
              : "bg-[#131720] text-[#8D96A5] hover:text-[#F4F5F7]"
          }`}
        >
          <Skull className="w-3.5 h-3.5" />
          <span>HUD PADS</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("missions")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === "missions"
              ? "bg-[#F7B267] text-[#0B0D12]"
              : "bg-[#131720] text-[#8D96A5] hover:text-[#F4F5F7]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>STORY</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("polls")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === "polls"
              ? "bg-[#2EC4B6] text-[#0B0D12]"
              : "bg-[#131720] text-[#8D96A5] hover:text-[#F4F5F7]"
          }`}
        >
          <Vote className="w-3.5 h-3.5" />
          <span>CHAT POLL</span>
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-3 space-y-4 pb-8">
        {activeTab === "controls" && (
          <>
            {/* Giant Tactile Action Pads */}
            <section className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    void mutateOverlay({ wastedDelta: 1 }, (prev) => ({
                      ...prev,
                      wastedCount: prev.wastedCount + 1,
                    }))
                  }
                  className="h-28 rounded-2xl bg-[#F25C54] hover:bg-[#F25C54]/90 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-1 text-[#0B0D12] shadow-lg shadow-[#F25C54]/15"
                >
                  <Skull className="w-7 h-7" />
                  <span className="font-hud font-extrabold text-2xl tracking-wide">
                    WASTED +1
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void mutateOverlay({ wastedDelta: -1 }, (prev) => ({
                      ...prev,
                      wastedCount: Math.max(0, prev.wastedCount - 1),
                    }))
                  }
                  className="h-10 rounded-xl bg-[#131720] border border-white/10 hover:border-white/25 active:scale-[0.98] flex items-center justify-center gap-1.5 text-xs font-semibold text-[#8D96A5] hover:text-[#F4F5F7]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo Wasted (-1)</span>
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    void mutateOverlay({ bustedDelta: 1 }, (prev) => ({
                      ...prev,
                      bustedCount: prev.bustedCount + 1,
                    }))
                  }
                  className="h-28 rounded-2xl bg-[#F7B267] hover:bg-[#F7B267]/90 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-1 text-[#0B0D12] shadow-lg shadow-[#F7B267]/15"
                >
                  <ShieldAlert className="w-7 h-7" />
                  <span className="font-hud font-extrabold text-2xl tracking-wide">
                    BUSTED +1
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void mutateOverlay({ bustedDelta: -1 }, (prev) => ({
                      ...prev,
                      bustedCount: Math.max(0, prev.bustedCount - 1),
                    }))
                  }
                  className="h-10 rounded-xl bg-[#131720] border border-white/10 hover:border-white/25 active:scale-[0.98] flex items-center justify-center gap-1.5 text-xs font-semibold text-[#8D96A5] hover:text-[#F4F5F7]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo Busted (-1)</span>
                </button>
              </div>
            </section>

            {/* Quick Cash Adjuster */}
            <section className="broadcast-card rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#2EC4B6]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
                    Quick Cash Adjuster
                  </h2>
                </div>
                {overlay.plan === "pro" ? (
                  <span className="font-hud font-extrabold text-xl text-[#2EC4B6]">
                    ${overlay.cashBalance.toLocaleString("en-US")}
                  </span>
                ) : (
                  <Link
                    href="/dashboard?checkout=lifetime"
                    className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#F7B267]/15 text-[#F7B267] hover:bg-[#F7B267]/25"
                  >
                    PRO FEATURE
                  </Link>
                )}
              </div>

              {overlay.plan !== "pro" ? (
                <div className="rounded-xl bg-[#0B0D12] border border-white/8 p-3 flex items-center justify-between gap-2 text-xs text-[#8D96A5]">
                  <span>Upgrade to Pro to unlock the live Cash Ticker widget.</span>
                  <Link
                    href="/dashboard?checkout=lifetime"
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-[#F25C54] text-white font-bold"
                  >
                    Unlock Pro
                  </Link>
                </div>
              ) : (
                <>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "-$500", delta: -500, neg: true },
                  { label: "+$1,000", delta: 1000, neg: false },
                  { label: "+$5,000", delta: 5000, neg: false },
                  { label: "+$25,000", delta: 25000, neg: false },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() =>
                      void mutateOverlay({ cashDelta: btn.delta }, (prev) => ({
                        ...prev,
                        cashBalance: Math.max(0, prev.cashBalance + btn.delta),
                      }))
                    }
                    className={`h-12 rounded-xl font-hud font-extrabold text-xl tracking-wide active:scale-[0.97] transition-all border ${
                      btn.neg
                        ? "bg-[#F25C54]/12 border-[#F25C54]/30 text-[#F25C54] hover:bg-[#F25C54]/20"
                        : "bg-[#2EC4B6]/12 border-[#2EC4B6]/30 text-[#2EC4B6] hover:bg-[#2EC4B6]/20"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Set exact cash (e.g. 124500)"
                  value={customCashInput}
                  onChange={(e) => setCustomCashInput(e.target.value)}
                  className="flex-1 h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5] focus:outline-none focus:border-[#2EC4B6]"
                />
                <button
                  type="button"
                  onClick={handleSetCashExact}
                  className="h-11 px-4 rounded-xl bg-[#2EC4B6] text-[#0B0D12] font-bold text-sm hover:bg-[#2EC4B6]/90 active:scale-[0.97]"
                >
                  SET
                </button>
              </div>
                </>
              )}
            </section>

            {/* Quick Active Poll Status Preview */}
            {overlay.activePoll?.isActive && (
              <section className="broadcast-card rounded-2xl p-3.5 space-y-2 border-[#2EC4B6]/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#F25C54] animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#F4F5F7]">
                      Live Poll: {overlay.activePoll.question}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleEndOrClearPoll("DELETE")}
                    className="text-xs font-bold text-[#F25C54] hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-[#8D96A5]">
                  <span>
                    !A {overlay.activePoll.optionA}:{" "}
                    <strong className="text-[#F4F5F7]">
                      {overlay.activePoll.votesA}
                    </strong>
                  </span>
                  <span>
                    !B {overlay.activePoll.optionB}:{" "}
                    <strong className="text-[#F4F5F7]">
                      {overlay.activePoll.votesB}
                    </strong>
                  </span>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === "missions" && (
          <section className="space-y-3.5">
            {/* Story Completion Slider & Quick Steppers */}
            <div className="broadcast-card rounded-2xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8D96A5]">
                    STORY COMPLETION
                  </div>
                  <div className="text-sm font-bold text-[#F7B267] truncate">
                    {overlay.storyChapter}
                  </div>
                </div>
                <div className="font-hud font-extrabold text-4xl leading-none text-[#F4F5F7] shrink-0">
                  {storyPercentDraft}%
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  aria-label="Story completion percentage"
                  value={storyPercentDraft}
                  onChange={(e) => {
                    const nextVal = Number(e.target.value);
                    setStoryPercentDraft(nextVal);
                    setOverlay((prev) => ({ ...prev, storyPercent: nextVal }));
                  }}
                  onPointerUp={() => commitStoryPercent(storyPercentDraft)}
                  onKeyUp={() => commitStoryPercent(storyPercentDraft)}
                  className="w-full h-2.5 rounded-lg bg-[#0B0D12] accent-[#F7B267] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] font-semibold text-[#8D96A5]">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "-1%", delta: -1, primary: false },
                  { label: "+1%", delta: 1, primary: true },
                  { label: "+5%", delta: 5, primary: true },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() =>
                      commitStoryPercent(storyPercentDraft + btn.delta)
                    }
                    className={`h-12 rounded-xl font-hud font-extrabold text-xl active:scale-[0.97] transition-all border ${
                      btn.primary
                        ? "bg-[#F7B267]/15 border-[#F7B267]/40 text-[#F7B267] hover:bg-[#F7B267]/25"
                        : "bg-[#0B0D12] border-white/12 text-[#8D96A5] hover:text-[#F4F5F7]"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Current Chapter / Objective */}
            <div className="broadcast-card rounded-2xl p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
                Current Chapter / Objective
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitStoryChapter(chapterInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  maxLength={60}
                  value={chapterInput}
                  onChange={(e) => setChapterInput(e.target.value)}
                  placeholder="Story Playthrough"
                  aria-label="Current Chapter or Objective"
                  className="flex-1 h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5] focus:outline-none focus:border-[#F7B267]"
                />
                <button
                  type="submit"
                  className="h-11 px-4 rounded-xl bg-[#F7B267] hover:bg-[#F7B267]/90 text-[#0B0D12] font-extrabold text-xs shrink-0 active:scale-[0.97] cursor-pointer"
                >
                  Update HUD
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5">
                {OBJECTIVE_PRESETS.map((preset) => {
                  const active = overlay.storyChapter === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => commitStoryChapter(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        active
                          ? "bg-[#F7B267] border-[#F7B267] text-[#0B0D12]"
                          : "bg-[#0B0D12] border-white/10 text-[#8D96A5] hover:text-[#F4F5F7]"
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {activeTab === "polls" && (
          <section className="space-y-3.5">
            {overlay.plan !== "pro" ? (
              <div className="broadcast-card rounded-2xl p-5 space-y-3 text-center border-[#F7B267]/30">
                <div className="inline-block rounded-full bg-[#F7B267]/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#F7B267]">
                  Pro Broadcaster Feature
                </div>
                <h2 className="font-hud font-extrabold text-2xl text-[#F4F5F7] uppercase">
                  Live Viewer Chat Polls (!A / !B)
                </h2>
                <p className="text-xs text-[#8D96A5] leading-relaxed">
                  Upgrade to the $49 Launch Pass (or $29/mo) to launch live !A / !B viewer polls on your OBS overlay and remove the watermark.
                </p>
                <Link
                  href="/dashboard?checkout=lifetime"
                  className="inline-flex h-11 px-5 rounded-xl bg-[#F25C54] text-white font-extrabold text-xs items-center justify-center"
                >
                  Unlock Pro Launch Pass ($49)
                </Link>
              </div>
            ) : (
            <>
            {/* Live Chat Connection Status */}
            <div className="broadcast-card rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
                  Live Chat Poll Engine
                </span>
                <Link
                  href="/dashboard"
                  className="text-xs font-semibold text-[#F7B267] hover:underline"
                >
                  Configure Channels
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[#0B0D12] border border-white/8 p-2.5">
                  <div className="text-[#8D96A5] font-semibold">Twitch</div>
                  <div className="font-bold text-[#F4F5F7] truncate">
                    {overlay.twitchChannel
                      ? `#${overlay.twitchChannel}`
                      : "Not set"}
                  </div>
                  <div className="text-[11px] text-[#2EC4B6] mt-0.5 capitalize">
                    {displayedChatStatus.twitchStatus}
                  </div>
                </div>
                <div className="rounded-xl bg-[#0B0D12] border border-white/8 p-2.5">
                  <div className="text-[#8D96A5] font-semibold">Kick</div>
                  <div className="font-bold text-[#F4F5F7] truncate">
                    {overlay.kickChannel || "Not set"}
                  </div>
                  <div className="text-[11px] text-[#2EC4B6] mt-0.5 capitalize">
                    {displayedChatStatus.kickStatus}
                  </div>
                </div>
              </div>
              {displayedChatStatus.kickNote && (
                <p className="text-[11px] text-[#F7B267]">
                  {displayedChatStatus.kickNote}
                </p>
              )}
            </div>

            {/* Active Poll Controls */}
            {overlay.activePoll?.isActive && (
              <div className="broadcast-card rounded-2xl p-3.5 space-y-3 border-[#2EC4B6]/40">
                <div className="flex items-center justify-between">
                  <span className="font-hud font-extrabold text-xl text-[#F4F5F7]">
                    {overlay.activePoll.question}
                  </span>
                  <span className="text-xs font-bold text-[#2EC4B6]">
                    ACTIVE
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-[#0B0D12] p-2.5 border border-[#F25C54]/30">
                    <div className="text-[#F25C54] font-bold">
                      !A | {overlay.activePoll.optionA}
                    </div>
                    <div className="font-hud font-extrabold text-2xl mt-1">
                      {overlay.activePoll.votesA}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#0B0D12] p-2.5 border border-[#F7B267]/30">
                    <div className="text-[#F7B267] font-bold">
                      !B | {overlay.activePoll.optionB}
                    </div>
                    <div className="font-hud font-extrabold text-2xl mt-1">
                      {overlay.activePoll.votesB}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleEndOrClearPoll("PATCH")}
                    className="h-11 rounded-xl bg-[#F7B267] text-[#0B0D12] font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>End Poll</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleEndOrClearPoll("DELETE")}
                    className="h-11 rounded-xl bg-[#F25C54]/15 border border-[#F25C54]/35 text-[#F25C54] font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Clear Card</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1-Tap Preset Poll Launchers */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
                1-Tap Preset Polls
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {PRESET_POLLS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      void handleStartPoll({
                        question: preset.question,
                        optionA: preset.optionA,
                        optionB: preset.optionB,
                        durationSeconds: preset.durationSeconds,
                      })
                    }
                    className="w-full text-left rounded-xl bg-[#131720] border border-white/10 hover:border-[#2EC4B6]/50 p-3 active:scale-[0.98] transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#F4F5F7] truncate">
                        {preset.label}
                      </div>
                      <div className="text-xs text-[#8D96A5] truncate">
                        !A {preset.optionA} | !B {preset.optionB}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-[#2EC4B6] text-[#0B0D12] px-2.5 py-1 text-xs font-extrabold">
                      START
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Poll Form */}
            <div className="broadcast-card rounded-2xl p-3.5 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
                Custom Poll
              </h3>
              <input
                type="text"
                placeholder="Question (e.g. NEXT MOVE?)"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="w-full h-10 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-sm text-[#F4F5F7]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Option !A"
                  value={pollOptionA}
                  onChange={(e) => setPollOptionA(e.target.value)}
                  className="h-10 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-xs text-[#F4F5F7]"
                />
                <input
                  type="text"
                  placeholder="Option !B"
                  value={pollOptionB}
                  onChange={(e) => setPollOptionB(e.target.value)}
                  className="h-10 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-xs text-[#F4F5F7]"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={pollDuration}
                  onChange={(e) => setPollDuration(Number(e.target.value))}
                  className="h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-xs text-[#F4F5F7]"
                >
                  <option value={30}>30s</option>
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                  <option value={120}>2m</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    void handleStartPoll({
                      question: pollQuestion,
                      optionA: pollOptionA,
                      optionB: pollOptionB,
                      durationSeconds: pollDuration,
                    })
                  }
                  className="flex-1 h-11 rounded-xl bg-[#2EC4B6] text-[#0B0D12] font-extrabold text-sm hover:bg-[#2EC4B6]/90 active:scale-[0.98]"
                >
                  START POLL
                </button>
              </div>
            </div>
            </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
