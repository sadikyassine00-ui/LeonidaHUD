"use client";

export type HudActionKey =
  | "storyPlus1"
  | "cashPlus2500"
  | "wastedPlus1"
  | "bustedPlus1"
  | "customPlus1"
  | "toggleClipMode";

export interface PollOptionState {
  id: "A" | "B";
  label: string;
  votes: number;
}

export interface PollState {
  active: boolean;
  question: string;
  options: PollOptionState[];
  durationSeconds: number;
  remainingSeconds: number;
}

export interface HudEventPayload {
  id: number;
  type: "wasted" | "busted" | "cash" | "story100" | "custom";
  delta?: number;
  label?: string;
}

export interface NeonHudState {
  storyPct: number;
  cash: number;
  wasted: number;
  busted: number;
  customLabel: string;
  customCount: number;
  clipMode: "16:9" | "9:16";
  hookBanner: string;
  soundEnabled: boolean;
  poll: PollState;
  hotkeys: Record<HudActionKey, string>;
  lastEvent: HudEventPayload | null;
}

export interface UndoSnapshot {
  label: string;
  previous: NeonHudState;
}

export const STORAGE_KEY = "leonida-hud-neon-state-v1";
export const SYNC_CHANNEL = "leonida-hud-neon-sync";

export const DEFAULT_NEON_HUD_STATE: NeonHudState = {
  storyPct: 42,
  cash: 128500,
  wasted: 3,
  busted: 1,
  customLabel: "Heists",
  customCount: 4,
  clipMode: "16:9",
  hookBanner: "Wait for the ending",
  soundEnabled: false,
  poll: {
    active: true,
    question: "Rob the bank?",
    options: [
      { id: "A", label: "Yes, go loud", votes: 38 },
      { id: "B", label: "No, stealth", votes: 24 },
    ],
    durationSeconds: 60,
    remainingSeconds: 44,
  },
  hotkeys: {
    storyPlus1: "1",
    cashPlus2500: "2",
    wastedPlus1: "3",
    bustedPlus1: "4",
    customPlus1: "5",
    toggleClipMode: "c",
  },
  lastEvent: null,
};

export function loadNeonHudState(): NeonHudState {
  if (typeof window === "undefined") return DEFAULT_NEON_HUD_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NEON_HUD_STATE;
    const parsed = JSON.parse(raw) as Partial<NeonHudState>;
    return {
      ...DEFAULT_NEON_HUD_STATE,
      ...parsed,
      poll: {
        ...DEFAULT_NEON_HUD_STATE.poll,
        ...(parsed.poll ?? {}),
      },
      hotkeys: {
        ...DEFAULT_NEON_HUD_STATE.hotkeys,
        ...(parsed.hotkeys ?? {}),
      },
    };
  } catch {
    return DEFAULT_NEON_HUD_STATE;
  }
}

export function saveAndBroadcastNeonHudState(state: NeonHudState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const channel = new BroadcastChannel(SYNC_CHANNEL);
    channel.postMessage({ type: "STATE_SYNC", state });
    channel.close();
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function triggerHaptic(ms = 10) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // Unsupported
    }
  }
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playTapBlip(enabled: boolean, freq = 660) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.055);
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

export function playSting(enabled: boolean, kind: "wasted" | "busted") {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  const startFreq = kind === "wasted" ? 165 : 210;
  const endFreq = kind === "wasted" ? 72 : 110;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.28);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.31);
}
