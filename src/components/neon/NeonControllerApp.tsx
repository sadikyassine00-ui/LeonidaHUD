"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Copy,
  Crop,
  DollarSign,
  ExternalLink,
  Gamepad2,
  Keyboard,
  Layers,
  MessageSquare,
  RotateCcw,
  Settings,
  ShieldAlert,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import "@/styles/leonida-neon.css";
import {
  DEFAULT_NEON_HUD_STATE,
  HudActionKey,
  loadNeonHudState,
  NeonHudState,
  playSting,
  playTapBlip,
  saveAndBroadcastNeonHudState,
  SYNC_CHANNEL,
  triggerHaptic,
  UndoSnapshot,
} from "@/lib/neon-hud-store";
import { ViewfinderBrackets } from "./ViewfinderBrackets";
import {
  SlicedSunGauge,
  SlicedSunLoader,
  SlicedSunMark,
  SunSliceCountdownArc,
  SunSliceDivider,
} from "./SlicedSun";
import { OdometerNumber } from "./OdometerNumber";
import { NumberPadSheet } from "./NumberPadSheet";
import { NeonOverlayCanvas } from "./NeonOverlayCanvas";

type TabId = "controls" | "overlay" | "clip" | "settings";

const POLL_PRESETS = [
  {
    question: "Rob the bank?",
    a: "Yes, go loud",
    b: "No, stealth",
  },
  {
    question: "Steal the jet or boat?",
    a: "Jet escape",
    b: "Speedboat",
  },
  {
    question: "Keep or spend the cash?",
    a: "Save it",
    b: "Buy upgrades",
  },
];

const HOOK_PRESETS = [
  "Wait for the ending",
  "Part 3 is insane",
  "No deaths story run",
  "Day 1 console launch",
];

interface PadTarget {
  key: "storyPct" | "cash" | "wasted" | "busted" | "customCount";
  title: string;
  value: number;
  max?: number;
}

export function NeonControllerApp({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [state, setState] = useState<NeonHudState>(DEFAULT_NEON_HUD_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("controls");
  const [undoToast, setUndoToast] = useState<UndoSnapshot | null>(null);
  const [padTarget, setPadTarget] = useState<PadTarget | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("Rob the bank?");
  const [pollOptA, setPollOptA] = useState("Yes, go loud");
  const [pollOptB, setPollOptB] = useState("No, stealth");
  const [backdrop, setBackdrop] = useState<"sunset" | "night" | "transparent">(
    "sunset"
  );
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [listeningHotkey, setListeningHotkey] = useState<HudActionKey | null>(
    null
  );
  const [flashedTile, setFlashedTile] = useState<string | null>(null);
  const [longPressTile, setLongPressTile] = useState<string | null>(null);
  const [showSkeletonDemo, setShowSkeletonDemo] = useState(false);

  const longPressTimerRef = useRef<number | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  // Hydrate from localStorage and listen to BroadcastChannel
  useEffect(() => {
    setState(loadNeonHudState());
    setHydrated(true);

    const ch = new BroadcastChannel(SYNC_CHANNEL);
    ch.onmessage = (ev) => {
      if (ev.data?.type === "STATE_SYNC" && ev.data.state) {
        setState(ev.data.state);
      }
    };
    return () => ch.close();
  }, []);

  // Poll countdown timer
  useEffect(() => {
    if (!state.poll.active || state.poll.remainingSeconds <= 0) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (!prev.poll.active) return prev;
        const nextRemaining = Math.max(0, prev.poll.remainingSeconds - 1);
        const next: NeonHudState = {
          ...prev,
          poll: {
            ...prev.poll,
            remainingSeconds: nextRemaining,
            active: nextRemaining > 0,
          },
        };
        saveAndBroadcastNeonHudState(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.poll.active, state.poll.remainingSeconds]);

  const commitState = useCallback(
    (
      updater: (prev: NeonHudState) => NeonHudState,
      undoLabel?: string,
      flashKey?: string
    ) => {
      setState((prev) => {
        const next = updater(prev);
        saveAndBroadcastNeonHudState(next);

        if (undoLabel) {
          setUndoToast({ label: undoLabel, previous: prev });
          if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
          undoTimerRef.current = window.setTimeout(() => {
            setUndoToast(null);
          }, 4000);
        }

        return next;
      });

      if (flashKey) {
        setFlashedTile(flashKey);
        window.setTimeout(() => setFlashedTile(null), 260);
      }
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (!undoToast) return;
    const restored = undoToast.previous;
    setState(restored);
    saveAndBroadcastNeonHudState(restored);
    setUndoToast(null);
    triggerHaptic(12);
    playTapBlip(restored.soundEnabled, 440);
  }, [undoToast]);

  // Shake-to-undo on mobile devices
  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      return;
    }
    let lastShake = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.abs(acc.x ?? 0) + Math.abs(acc.y ?? 0) + Math.abs(acc.z ?? 0);
      if (mag > 34 && Date.now() - lastShake > 1200 && undoToast) {
        lastShake = Date.now();
        handleUndo();
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [undoToast, handleUndo]);

  const bumpStory = useCallback(
    (delta: number) => {
      triggerHaptic(10);
      playTapBlip(state.soundEnabled, 740);
      commitState(
        (prev) => ({
          ...prev,
          storyPct: Math.max(0, Math.min(100, prev.storyPct + delta)),
        }),
        `Story ${delta >= 0 ? `+${delta}%` : `${delta}%`}`,
        "story"
      );
    },
    [commitState, state.soundEnabled]
  );

  const bumpCash = useCallback(
    (delta: number) => {
      triggerHaptic(10);
      playTapBlip(state.soundEnabled, delta >= 0 ? 820 : 520);
      commitState(
        (prev) => ({
          ...prev,
          cash: Math.max(0, prev.cash + delta),
          lastEvent: { id: Date.now(), type: "cash", delta },
        }),
        `Cash ${delta >= 0 ? `+$${delta.toLocaleString("en-US")}` : `-$${Math.abs(delta).toLocaleString("en-US")}`}`,
        "cash"
      );
    },
    [commitState, state.soundEnabled]
  );

  const bumpWasted = useCallback(() => {
    triggerHaptic(16);
    playSting(state.soundEnabled, "wasted");
    commitState(
      (prev) => ({
        ...prev,
        wasted: prev.wasted + 1,
        lastEvent: { id: Date.now(), type: "wasted" },
      }),
      "Wasted +1",
      "wasted"
    );
  }, [commitState, state.soundEnabled]);

  const bumpBusted = useCallback(() => {
    triggerHaptic(16);
    playSting(state.soundEnabled, "busted");
    commitState(
      (prev) => ({
        ...prev,
        busted: prev.busted + 1,
        lastEvent: { id: Date.now(), type: "busted" },
      }),
      "Busted +1",
      "busted"
    );
  }, [commitState, state.soundEnabled]);

  const bumpCustom = useCallback(() => {
    triggerHaptic(10);
    playTapBlip(state.soundEnabled, 690);
    commitState(
      (prev) => ({
        ...prev,
        customCount: prev.customCount + 1,
        lastEvent: { id: Date.now(), type: "custom" },
      }),
      `${state.customLabel} +1`,
      "custom"
    );
  }, [commitState, state.customLabel, state.soundEnabled]);

  const toggleClipMode = useCallback(() => {
    triggerHaptic(10);
    playTapBlip(state.soundEnabled, 600);
    commitState((prev) => ({
      ...prev,
      clipMode: prev.clipMode === "16:9" ? "9:16" : "16:9",
    }));
  }, [commitState, state.soundEnabled]);

  // Global keyboard hotkey listener for Stream Deck / Hotkey two-way sync
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (listeningHotkey) {
        e.preventDefault();
        commitState((prev) => ({
          ...prev,
          hotkeys: { ...prev.hotkeys, [listeningHotkey]: key },
        }));
        setListeningHotkey(null);
        return;
      }

      if (key === state.hotkeys.storyPlus1) bumpStory(1);
      else if (key === state.hotkeys.cashPlus2500) bumpCash(2500);
      else if (key === state.hotkeys.wastedPlus1) bumpWasted();
      else if (key === state.hotkeys.bustedPlus1) bumpBusted();
      else if (key === state.hotkeys.customPlus1) bumpCustom();
      else if (key === state.hotkeys.toggleClipMode) toggleClipMode();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    listeningHotkey,
    state.hotkeys,
    commitState,
    bumpStory,
    bumpCash,
    bumpWasted,
    bumpBusted,
    bumpCustom,
    toggleClipMode,
  ]);

  // Long-press helper (400ms hold opens NumberPadSheet)
  const startLongPress = (tileId: string, target: PadTarget) => {
    setLongPressTile(tileId);
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setLongPressTile(null);
      triggerHaptic(18);
      setPadTarget(target);
    }, 400);
  };

  const cancelLongPress = () => {
    setLongPressTile(null);
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const launchPoll = () => {
    triggerHaptic(12);
    playTapBlip(state.soundEnabled, 780);
    commitState((prev) => ({
      ...prev,
      poll: {
        active: true,
        question: pollQuestion.trim() || "What next?",
        options: [
          { id: "A", label: pollOptA.trim() || "Yes", votes: 1 },
          { id: "B", label: pollOptB.trim() || "No", votes: 0 },
        ],
        durationSeconds: 60,
        remainingSeconds: 60,
      },
    }));
    setPollOpen(false);
  };

  const simulatePollVote = (optId: "A" | "B") => {
    triggerHaptic(8);
    commitState((prev) => ({
      ...prev,
      poll: {
        ...prev.poll,
        options: prev.poll.options.map((o) =>
          o.id === optId ? { ...o, votes: o.votes + 3 } : o
        ),
      },
    }));
  };

  const copyOverlayUrl = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/overlay?obs=1`
        : "https://leonidahud.vercel.app/overlay?obs=1";
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "controls", label: "Controls", icon: <Gamepad2 className="w-4 h-4" /> },
    { id: "overlay", label: "Overlay", icon: <Layers className="w-4 h-4" /> },
    { id: "clip", label: "Clip Mode", icon: <Crop className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div
      data-leonida-theme="neon-sunset"
      className={`neon-surface flex flex-col ${
        embedded ? "rounded-[28px] border border-[var(--line-muted)]/40 overflow-hidden" : "min-h-screen"
      }`}
    >
      {/* Top Status Bar */}
      <header className="sticky top-0 z-30 bg-[var(--bg-night)]/92 backdrop-blur-md border-b border-[var(--line-muted)]/30 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <SlicedSunMark size={38} />
            <div>
              <div
                className="chroma-wordmark text-lg leading-none"
                data-text="LEONIDA HUD"
              >
                <span>LEONIDA HUD</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
                Broadcast Controller
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-deep)] border border-[var(--pink)]/50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--text)] neon-glow-pink">
              <span className="w-2 h-2 rounded-full bg-[var(--pink)] animate-pulse" />
              <span>LIVE</span>
            </div>
            {!embedded && (
              <Link
                href="/overlay"
                target="_blank"
                aria-label="Open OBS Overlay window"
                className="w-10 h-10 rounded-xl bg-[var(--bg-deep)] border border-[var(--teal)]/45 flex items-center justify-center text-[var(--teal)] hover:bg-[var(--track)] neon-focus"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 pb-28">
        {!hydrated || showSkeletonDemo ? (
          <div className="neon-card p-8 my-6">
            <SlicedSunLoader label="Syncing HUD Channels" />
          </div>
        ) : (
          <>
            {/* TAB 1: CONTROLS */}
            {activeTab === "controls" && (
              <div key="tab-controls" className="space-y-4 animate-tab-in">
                {/* Hero Story % Card */}
                <section className="relative neon-card p-5 overflow-hidden neon-glow-pink">
                  <ViewfinderBrackets size={14} thickness={2.5} offset={8} />

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--sun-yellow)]">
                        Story Completion
                      </div>
                      <div
                        className="chroma-wordmark text-5xl leading-none"
                        data-text={`${state.storyPct}%`}
                      >
                        <span>
                          <OdometerNumber value={state.storyPct} suffix="%" />
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-dim)]">
                        Hold card 0.4s for exact %
                      </div>
                    </div>

                    <button
                      type="button"
                      onPointerDown={() =>
                        startLongPress("story", {
                          key: "storyPct",
                          title: "Story %",
                          value: state.storyPct,
                          max: 100,
                        })
                      }
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onClick={() => bumpStory(1)}
                      aria-label="Story gauge, tap to add 1 percent or hold to edit"
                      className="relative rounded-2xl p-1 active:scale-95 transition-transform neon-focus"
                    >
                      <SlicedSunGauge
                        percent={state.storyPct}
                        burst={state.storyPct === 100}
                      />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => bumpStory(1)}
                      className="h-14 rounded-xl bg-[var(--track)] hover:bg-[var(--purple)] active:scale-95 text-sm font-extrabold text-[var(--text)] transition-transform neon-focus"
                    >
                      +1%
                    </button>
                    <button
                      type="button"
                      onClick={() => bumpStory(5)}
                      className="h-14 rounded-xl bg-[var(--pink)] hover:opacity-95 active:scale-95 text-sm font-extrabold text-[var(--text)] transition-transform neon-focus"
                    >
                      +5%
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPadTarget({
                          key: "storyPct",
                          title: "Story %",
                          value: state.storyPct,
                          max: 100,
                        })
                      }
                      className="h-14 rounded-xl bg-[var(--bg-night)] border border-[var(--teal)]/50 hover:border-[var(--teal)] active:scale-95 text-xs font-extrabold uppercase tracking-wider text-[var(--teal)] transition-transform neon-focus"
                    >
                      Custom
                    </button>
                  </div>
                </section>

                {/* 2x2 Grid of Counter Tiles (>= 120px tall) */}
                <section className="grid grid-cols-2 gap-3">
                  {/* CASH TILE (Orange) */}
                  <div
                    className={`relative neon-card min-h-[136px] p-4 flex flex-col justify-between transition-transform active:scale-[0.96] ${
                      flashedTile === "cash"
                        ? "neon-glow-orange ring-1 ring-[var(--orange)]"
                        : "border-[var(--orange)]/40"
                    }`}
                  >
                    {longPressTile === "cash" && (
                      <span className="absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-[var(--orange)] animate-ping" />
                    )}
                    <button
                      type="button"
                      onPointerDown={() =>
                        startLongPress("cash", {
                          key: "cash",
                          title: "Cash ($)",
                          value: state.cash,
                        })
                      }
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onClick={() => bumpCash(2500)}
                      className="text-left flex-1 flex flex-col justify-between neon-focus rounded-xl"
                      aria-label="Add 2500 dollars cash, hold to enter exact cash"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--orange)]">
                          <DollarSign className="w-3.5 h-3.5" />
                          Cash
                        </span>
                        <span className="text-[10px] font-bold text-[var(--text-dim)]">
                          +$2.5k
                        </span>
                      </div>
                      <div className="neon-display text-2xl sm:text-3xl text-[var(--text)] mt-2">
                        <OdometerNumber value={state.cash} prefix="$" />
                      </div>
                    </button>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => bumpCash(-500)}
                        className="flex-1 h-8 rounded-lg bg-[var(--bg-night)] border border-[var(--pink)]/40 text-[11px] font-extrabold text-[var(--pink)] active:scale-95 neon-focus"
                      >
                        -$500
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPadTarget({
                            key: "cash",
                            title: "Cash ($)",
                            value: state.cash,
                          })
                        }
                        className="px-2.5 h-8 rounded-lg bg-[var(--bg-night)] border border-[var(--line-muted)]/40 text-[11px] font-bold text-[var(--text-dim)] active:scale-95 neon-focus"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* WASTED TILE (Pink) */}
                  <button
                    type="button"
                    onPointerDown={() =>
                      startLongPress("wasted", {
                        key: "wasted",
                        title: "Wasted",
                        value: state.wasted,
                      })
                    }
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onClick={bumpWasted}
                    className={`relative neon-card min-h-[136px] p-4 flex flex-col justify-between text-left transition-transform active:scale-[0.96] neon-focus ${
                      flashedTile === "wasted"
                        ? "neon-glow-pink ring-1 ring-[var(--pink)]"
                        : "border-[var(--pink)]/45"
                    }`}
                  >
                    {longPressTile === "wasted" && (
                      <span className="absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-[var(--pink)] animate-ping" />
                    )}
                    <div className="flex items-center justify-between w-full">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--pink)]">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Wasted
                      </span>
                      <span className="text-[11px] font-extrabold text-[var(--pink)]">
                        +1 TAP
                      </span>
                    </div>
                    <div className="neon-display text-4xl text-[var(--text)]">
                      <OdometerNumber value={state.wasted} />
                    </div>
                    <div className="text-[10px] font-semibold text-[var(--text-dim)]">
                      Triggers overlay stamp
                    </div>
                  </button>

                  {/* BUSTED TILE (Teal) */}
                  <button
                    type="button"
                    onPointerDown={() =>
                      startLongPress("busted", {
                        key: "busted",
                        title: "Busted",
                        value: state.busted,
                      })
                    }
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onClick={bumpBusted}
                    className={`relative neon-card min-h-[136px] p-4 flex flex-col justify-between text-left transition-transform active:scale-[0.96] neon-focus ${
                      flashedTile === "busted"
                        ? "neon-glow-teal ring-1 ring-[var(--teal)]"
                        : "border-[var(--teal)]/45"
                    }`}
                  >
                    {longPressTile === "busted" && (
                      <span className="absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-[var(--teal)] animate-ping" />
                    )}
                    <div className="flex items-center justify-between w-full">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--teal)]">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Busted
                      </span>
                      <span className="text-[11px] font-extrabold text-[var(--teal)]">
                        +1 TAP
                      </span>
                    </div>
                    <div className="neon-display text-4xl text-[var(--text)]">
                      <OdometerNumber value={state.busted} />
                    </div>
                    <div className="text-[10px] font-semibold text-[var(--text-dim)]">
                      Hold 0.4s to set exact
                    </div>
                  </button>

                  {/* CUSTOM TILE (Sun Yellow) */}
                  <button
                    type="button"
                    onPointerDown={() =>
                      startLongPress("custom", {
                        key: "customCount",
                        title: state.customLabel,
                        value: state.customCount,
                      })
                    }
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onClick={bumpCustom}
                    className={`relative neon-card min-h-[136px] p-4 flex flex-col justify-between text-left transition-transform active:scale-[0.96] neon-focus ${
                      flashedTile === "custom"
                        ? "neon-glow-yellow ring-1 ring-[var(--sun-yellow)]"
                        : "border-[var(--sun-yellow)]/40"
                    }`}
                  >
                    {longPressTile === "custom" && (
                      <span className="absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-[var(--sun-yellow)] animate-ping" />
                    )}
                    <div className="flex items-center justify-between w-full">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--sun-yellow)]">
                        <Sparkles className="w-3.5 h-3.5" />
                        {state.customLabel}
                      </span>
                      <span className="text-[11px] font-extrabold text-[var(--sun-yellow)]">
                        +1 TAP
                      </span>
                    </div>
                    <div className="neon-display text-4xl text-[var(--text)]">
                      <OdometerNumber value={state.customCount} />
                    </div>
                    <div className="text-[10px] font-semibold text-[var(--text-dim)]">
                      Custom counter
                    </div>
                  </button>
                </section>

                <SunSliceDivider />

                {/* Bottom Sheet: Chat Poll */}
                <section
                  className="neon-card p-4 space-y-3"
                  style={{ borderRadius: "var(--radius-sheet)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[var(--teal)]" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text)]">
                        Twitch / Kick Poll
                      </span>
                    </div>
                    {state.poll.active && (
                      <SunSliceCountdownArc
                        remaining={state.poll.remainingSeconds}
                        total={state.poll.durationSeconds}
                      />
                    )}
                  </div>

                  {state.poll.active ? (
                    <div className="space-y-2.5">
                      <div className="text-sm font-bold text-[var(--text)]">
                        {state.poll.question}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {state.poll.options.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => simulatePollVote(o.id)}
                            className="h-14 px-3 rounded-xl bg-[var(--track)]/75 hover:bg-[var(--track)] border border-[var(--teal)]/35 flex items-center justify-between text-xs font-extrabold text-[var(--text)] active:scale-95 transition-transform neon-focus"
                          >
                            <span className="truncate">
                              !{o.id} {o.label}
                            </span>
                            <span className="text-[var(--teal)] neon-tabular">
                              {o.votes}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPollOpen((v) => !v)}
                          className="flex-1 h-11 rounded-xl bg-[var(--bg-night)] border border-[var(--line-muted)]/45 text-xs font-extrabold text-[var(--text-dim)] neon-focus"
                        >
                          New Poll
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitState((prev) => ({
                              ...prev,
                              poll: { ...prev.poll, active: false },
                            }))
                          }
                          className="h-11 px-4 rounded-xl bg-[var(--bg-night)] border border-[var(--pink)]/45 text-xs font-extrabold text-[var(--pink)] neon-focus"
                        >
                          End Poll
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPollOpen(true)}
                      className="w-full h-14 rounded-2xl bg-[var(--teal)] text-[#11072B] font-extrabold text-sm neon-glow-teal active:scale-[0.98] transition-transform neon-focus"
                    >
                      Start Chat Poll (!A / !B)
                    </button>
                  )}

                  {pollOpen && (
                    <div className="pt-2 space-y-2.5 border-t border-[var(--line-muted)]/35">
                      <div className="flex flex-wrap gap-1.5">
                        {POLL_PRESETS.map((p) => (
                          <button
                            key={p.question}
                            type="button"
                            onClick={() => {
                              setPollQuestion(p.question);
                              setPollOptA(p.a);
                              setPollOptB(p.b);
                            }}
                            className="px-2.5 py-1 rounded-full bg-[var(--track)]/80 hover:bg-[var(--purple)] text-[11px] font-bold text-[var(--text)] neon-focus"
                          >
                            {p.question}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        aria-label="Poll question"
                        className="w-full h-11 px-3 rounded-xl bg-[var(--bg-night)] border border-[var(--line-muted)]/50 text-sm text-[var(--text)] neon-focus"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={pollOptA}
                          onChange={(e) => setPollOptA(e.target.value)}
                          aria-label="Poll option A"
                          className="h-11 px-3 rounded-xl bg-[var(--bg-night)] border border-[var(--line-muted)]/50 text-xs text-[var(--text)] neon-focus"
                        />
                        <input
                          type="text"
                          value={pollOptB}
                          onChange={(e) => setPollOptB(e.target.value)}
                          aria-label="Poll option B"
                          className="h-11 px-3 rounded-xl bg-[var(--bg-night)] border border-[var(--line-muted)]/50 text-xs text-[var(--text)] neon-focus"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={launchPoll}
                        className="w-full h-12 rounded-xl bg-[var(--pink)] text-[var(--text)] font-extrabold text-sm neon-glow-pink neon-focus"
                      >
                        Launch 60s Poll
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 2: OVERLAY LIVE PREVIEW */}
            {activeTab === "overlay" && (
              <div key="tab-overlay" className="space-y-4 animate-tab-in">
                <div className="relative neon-card p-3 space-y-3 neon-glow-teal">
                  <ViewfinderBrackets size={14} thickness={2.5} offset={6} />
                  <div className="flex items-center justify-between px-1 pt-1">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--teal)]">
                      Live OBS Preview ({state.clipMode})
                    </span>
                    <button
                      type="button"
                      onClick={toggleClipMode}
                      className="px-3 h-9 rounded-xl bg-[var(--track)] text-xs font-extrabold text-[var(--text)] neon-focus"
                    >
                      Switch to {state.clipMode === "16:9" ? "9:16" : "16:9"}
                    </button>
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-[var(--line-muted)]/40 bg-[#0d0622]">
                    <NeonOverlayCanvas
                      state={state}
                      backdrop={backdrop}
                      compactPreview
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["sunset", "night", "transparent"] as const).map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setBackdrop(bg)}
                        className={`h-10 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border transition-colors neon-focus ${
                          backdrop === bg
                            ? "bg-[var(--teal)] text-[#11072B] border-[var(--teal)]"
                            : "bg-[var(--bg-night)] text-[var(--text-dim)] border-[var(--line-muted)]/40"
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="neon-card p-4 space-y-3">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--text)]">
                    OBS Browser Source URL (1920x1080)
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyOverlayUrl}
                      className="flex-1 h-12 rounded-xl bg-[var(--pink)] text-[var(--text)] font-extrabold text-sm inline-flex items-center justify-center gap-2 neon-glow-pink neon-focus"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied /overlay?obs=1</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy OBS Overlay Link</span>
                        </>
                      )}
                    </button>
                    <Link
                      href="/overlay"
                      target="_blank"
                      className="h-12 px-4 rounded-xl bg-[var(--track)] text-[var(--text)] font-extrabold text-xs inline-flex items-center gap-1.5 neon-focus"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CLIP MODE & HOOK BANNER */}
            {activeTab === "clip" && (
              <div key="tab-clip" className="space-y-4 animate-tab-in">
                <section className="relative neon-card p-5 space-y-4">
                  <ViewfinderBrackets size={14} thickness={2.5} offset={8} />
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--teal)]">
                      Aspect Frame
                    </div>
                    <h2 className="neon-display text-2xl text-[var(--text)]">
                      16:9 Stream vs 9:16 Clip-Safe
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(["16:9", "9:16"] as const).map((mode) => {
                      const active = state.clipMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() =>
                            commitState((prev) => ({ ...prev, clipMode: mode }))
                          }
                          className={`h-16 rounded-2xl border font-extrabold text-sm transition-all neon-focus ${
                            active
                              ? "bg-[var(--teal)]/15 border-[var(--teal)] text-[var(--teal)] neon-glow-teal"
                              : "bg-[var(--bg-night)] border-[var(--line-muted)]/40 text-[var(--text-dim)]"
                          }`}
                        >
                          {mode === "16:9" ? "16:9 Widescreen" : "9:16 Clip-Safe"}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="neon-card p-5 space-y-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--pink)]">
                    Top Hook Banner (Typewriter 25ms)
                  </div>
                  <input
                    type="text"
                    value={state.hookBanner}
                    onChange={(e) =>
                      commitState((prev) => ({
                        ...prev,
                        hookBanner: e.target.value,
                      }))
                    }
                    placeholder="Type a vertical clip hook..."
                    aria-label="Top Hook Banner text"
                    className="w-full h-12 px-4 rounded-xl bg-[var(--bg-night)] border border-[var(--pink)]/50 text-sm font-bold text-[var(--text)] neon-focus"
                  />
                  <div className="flex flex-wrap gap-2">
                    {HOOK_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          commitState((prev) => ({
                            ...prev,
                            hookBanner: preset,
                          }))
                        }
                        className="px-3 h-9 rounded-full bg-[var(--track)] hover:bg-[var(--purple)] text-xs font-bold text-[var(--text)] neon-focus"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB 4: SETTINGS (HOTKEYS, SOUND, LOADER) */}
            {activeTab === "settings" && (
              <div key="tab-settings" className="space-y-4 animate-tab-in">
                {/* Sound Toggle */}
                <section className="neon-card p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {state.soundEnabled ? (
                      <Volume2 className="w-5 h-5 text-[var(--teal)]" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-[var(--text-dim)]" />
                    )}
                    <div>
                      <div className="text-sm font-extrabold text-[var(--text)]">
                        Synth Tap &amp; Sting Audio
                      </div>
                      <div className="text-xs text-[var(--text-dim)]">
                        Off by default. Blips on tap, low sting on Wasted/Busted.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      commitState((prev) => ({
                        ...prev,
                        soundEnabled: !prev.soundEnabled,
                      }))
                    }
                    className={`h-11 px-4 rounded-full font-extrabold text-xs uppercase tracking-wider transition-colors neon-focus ${
                      state.soundEnabled
                        ? "bg-[var(--teal)] text-[#11072B]"
                        : "bg-[var(--track)] text-[var(--text)]"
                    }`}
                  >
                    {state.soundEnabled ? "On" : "Off"}
                  </button>
                </section>

                {/* Stream Deck / Hotkey Mapping */}
                <section className="neon-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-[var(--orange)]" />
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text)]">
                      Stream Deck &amp; Hotkey Mapping
                    </h2>
                  </div>
                  <p className="text-xs text-[var(--text-dim)]">
                    Click a key badge to rebind, or press any bound key on your
                    keyboard to trigger two-way synced updates.
                  </p>

                  <div className="space-y-2">
                    {(
                      [
                        ["storyPlus1", "Story +1%"],
                        ["cashPlus2500", "Cash +$2,500"],
                        ["wastedPlus1", "Wasted +1"],
                        ["bustedPlus1", "Busted +1"],
                        ["customPlus1", `${state.customLabel} +1`],
                        ["toggleClipMode", "Toggle 16:9 / 9:16"],
                      ] as Array<[HudActionKey, string]>
                    ).map(([action, label]) => {
                      const isListening = listeningHotkey === action;
                      return (
                        <div
                          key={action}
                          className="flex items-center justify-between rounded-xl bg-[var(--bg-night)] border border-[var(--line-muted)]/35 px-3 py-2.5"
                        >
                          <span className="text-xs font-bold text-[var(--text)]">
                            {label}
                          </span>
                          <button
                            type="button"
                            onClick={() => setListeningHotkey(action)}
                            className={`min-w-[64px] h-9 px-3 rounded-lg text-xs font-extrabold uppercase neon-focus ${
                              isListening
                                ? "bg-[var(--pink)] text-[var(--text)] animate-pulse"
                                : "bg-[var(--track)] text-[var(--teal)]"
                            }`}
                          >
                            {isListening ? "Press key" : state.hotkeys[action]}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Custom Label & Loader Demo / Reset */}
                <section className="neon-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[var(--sun-yellow)]" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text)]">
                      Custom Tile Label &amp; Utilities
                    </span>
                  </div>
                  <input
                    type="text"
                    value={state.customLabel}
                    onChange={(e) =>
                      commitState((prev) => ({
                        ...prev,
                        customLabel: e.target.value,
                      }))
                    }
                    aria-label="Custom counter label"
                    className="w-full h-11 px-3 rounded-xl bg-[var(--bg-night)] border border-[var(--line-muted)]/50 text-sm text-[var(--text)] neon-focus"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSkeletonDemo(true);
                        window.setTimeout(() => setShowSkeletonDemo(false), 1600);
                      }}
                      className="h-11 rounded-xl bg-[var(--track)] text-xs font-extrabold text-[var(--text)] neon-focus"
                    >
                      Preview Sun Loader
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setState(DEFAULT_NEON_HUD_STATE);
                        saveAndBroadcastNeonHudState(DEFAULT_NEON_HUD_STATE);
                      }}
                      className="h-11 rounded-xl bg-[var(--bg-night)] border border-[var(--pink)]/50 text-xs font-extrabold text-[var(--pink)] inline-flex items-center justify-center gap-1.5 neon-focus"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Demo</span>
                    </button>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </main>

      {/* Undo Toast with 4s Shrinking Teal Timer Bar */}
      {undoToast && (
        <div
          key={undoToast.label + Date.now()}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-[var(--bg-deep)] border border-[var(--teal)]/60 overflow-hidden neon-glow-teal"
        >
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-xs font-extrabold text-[var(--text)]">
              {undoToast.label}
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="px-3 h-8 rounded-lg bg-[var(--teal)] text-[#11072B] text-xs font-extrabold uppercase tracking-wider neon-focus"
            >
              Undo
            </button>
          </div>
          <div className="h-1 w-full bg-[var(--track)]">
            <div className="h-full bg-[var(--teal)] animate-undo-shrink" />
          </div>
        </div>
      )}

      {/* Bottom Tab Bar (4 tabs, active tab gets teal bracket underline) */}
      <nav
        aria-label="Controller navigation"
        className={`${
          embedded ? "sticky" : "fixed"
        } bottom-0 inset-x-0 z-30 bg-[var(--bg-night)]/95 backdrop-blur-md border-t border-[var(--line-muted)]/35 px-2 py-2`}
      >
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  playTapBlip(state.soundEnabled, 580);
                }}
                className={`relative h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold transition-colors neon-focus ${
                  active
                    ? "text-[var(--teal)] bg-[var(--bg-deep)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text)]"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 w-8 h-1 rounded-full bg-[var(--teal)] shadow-[0_0_10px_var(--teal)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Long-Press Exact Value Number Pad Sheet */}
      <NumberPadSheet
        open={Boolean(padTarget)}
        title={padTarget?.title ?? ""}
        initialValue={padTarget?.value ?? 0}
        maxValue={padTarget?.max}
        onClose={() => setPadTarget(null)}
        onApply={(nextVal) => {
          if (!padTarget) return;
          commitState(
            (prev) => ({
              ...prev,
              [padTarget.key]: nextVal,
            }),
            `Set ${padTarget.title}`,
            padTarget.key
          );
        }}
      />
    </div>
  );
}
