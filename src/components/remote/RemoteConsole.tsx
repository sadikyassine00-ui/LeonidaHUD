"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  DollarSign,
  ExternalLink,
  Layers,
  Plus,
  Radio,
  RotateCcw,
  Settings,
  ShieldAlert,
  Skull,
  Square,
  Vote,
} from "lucide-react";
import { DEFAULT_MISSIONS } from "@/data/missions";
import {
  startChatPollListeners,
  type ChatPollListenerHandle,
  type ChatVoteCounts,
} from "@/lib/chat-poll-listener";
import { PRESET_POLLS, type MissionItem, type OverlayStateSnapshot } from "@/lib/types";

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
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [customMissionTitle, setCustomMissionTitle] = useState<string>("");
  const [customMissionRegion, setCustomMissionRegion] = useState<string>("Leonida");
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

  const allMissions = useMemo<MissionItem[]>(() => {
    return [...DEFAULT_MISSIONS, ...(overlay.customMissions ?? [])];
  }, [overlay.customMissions]);

  const chapterMissions = useMemo(() => {
    return allMissions.filter((m) => m.chapterNumber === selectedChapter);
  }, [allMissions, selectedChapter]);

  const completedSet = useMemo(
    () => new Set(overlay.completedMissionIds),
    [overlay.completedMissionIds]
  );

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
          <span>MISSIONS</span>
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
                <span className="font-hud font-extrabold text-xl text-[#2EC4B6]">
                  ${overlay.cashBalance.toLocaleString("en-US")}
                </span>
              </div>

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
          <section className="space-y-3">
            <div className="broadcast-card rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8D96A5]">
                    ACTIVE CHAPTER
                  </div>
                  <div className="text-sm font-bold text-[#F7B267]">
                    {overlay.storyChapter}
                  </div>
                </div>
                <div className="font-hud font-extrabold text-3xl text-[#F4F5F7]">
                  {overlay.storyPercent}%
                </div>
              </div>

              <div className="grid grid-cols-6 gap-1 mt-2">
                {[1, 2, 3, 4, 5, 6].map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setSelectedChapter(ch)}
                    className={`py-1.5 rounded-lg font-hud font-bold text-sm transition-colors ${
                      selectedChapter === ch
                        ? "bg-[#F7B267] text-[#0B0D12]"
                        : "bg-[#0B0D12] text-[#8D96A5] hover:text-[#F4F5F7]"
                    }`}
                  >
                    CH {ch}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {chapterMissions.map((mission) => {
                const done = completedSet.has(mission.id);
                return (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() =>
                      void mutateOverlay(
                        { toggleMissionId: mission.id },
                        (prev) => {
                          const exists = prev.completedMissionIds.includes(
                            mission.id
                          );
                          const nextIds = exists
                            ? prev.completedMissionIds.filter(
                                (id) => id !== mission.id
                              )
                            : [...prev.completedMissionIds, mission.id];
                          return {
                            ...prev,
                            completedMissionIds: nextIds,
                          };
                        }
                      )
                    }
                    className={`w-full text-left rounded-xl p-3 border transition-all flex items-center justify-between gap-3 active:scale-[0.99] ${
                      done
                        ? "bg-[#2EC4B6]/10 border-[#2EC4B6]/35"
                        : "bg-[#131720] border-white/8 hover:border-white/20"
                    }`}
                  >
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-semibold truncate ${
                          done ? "text-[#F4F5F7]" : "text-[#F4F5F7]"
                        }`}
                      >
                        {mission.title}
                      </div>
                      <div className="text-xs text-[#8D96A5]">
                        {mission.region}
                        {mission.isCustom ? " | Custom" : ""}
                      </div>
                    </div>
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                        done
                          ? "bg-[#2EC4B6] border-[#2EC4B6] text-[#0B0D12]"
                          : "bg-[#0B0D12] border-white/15 text-transparent"
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Mission Adder (Pro) */}
            <div className="broadcast-card rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
                  Add Custom Mission
                </span>
                {overlay.plan === "free" && (
                  <span className="text-[11px] font-bold text-[#F7B267]">
                    PRO FEATURE
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Mission title"
                  value={customMissionTitle}
                  onChange={(e) => setCustomMissionTitle(e.target.value)}
                  disabled={overlay.plan !== "pro"}
                  className="flex-1 h-10 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-xs text-[#F4F5F7] placeholder:text-[#8D96A5] disabled:opacity-50"
                />
                <input
                  type="text"
                  placeholder="Region"
                  value={customMissionRegion}
                  onChange={(e) => setCustomMissionRegion(e.target.value)}
                  disabled={overlay.plan !== "pro"}
                  className="w-24 h-10 rounded-xl bg-[#0B0D12] border border-white/10 px-2.5 text-xs text-[#F4F5F7] placeholder:text-[#8D96A5] disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                disabled={overlay.plan !== "pro" || !customMissionTitle.trim()}
                onClick={() => {
                  const title = customMissionTitle.trim();
                  if (!title) return;
                  setCustomMissionTitle("");
                  void mutateOverlay({
                    addCustomMission: {
                      chapterNumber: selectedChapter,
                      chapterTitle: `Chapter ${selectedChapter}: Custom Operations`,
                      title,
                      region: customMissionRegion.trim() || "Leonida",
                    },
                  });
                }}
                className="w-full h-10 rounded-xl bg-[#F7B267] text-[#0B0D12] font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Chapter {selectedChapter}</span>
              </button>
            </div>
          </section>
        )}

        {activeTab === "polls" && (
          <section className="space-y-3.5">
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
          </section>
        )}
      </main>
    </div>
  );
}
