"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  LogOut,
  Monitor,
  Palette,
  RefreshCw,
  Smartphone,
  SmartphoneNfc,
  Tv,
  Webhook,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { PaddleUpgradeButtons } from "@/components/billing/PaddleUpgradeButtons";
import { ScaledHudPreview } from "@/components/hud/ScaledHudPreview";
import type { HudTheme, OverlayStateSnapshot } from "@/lib/types";

interface DashboardClientProps {
  initialOverlay: OverlayStateSnapshot;
  user: {
    id: string;
    email: string;
    name: string | null;
    plan: "free" | "pro";
    planType?: "free" | "lifetime" | "monthly";
    subscriptionStatus: string;
  };
  hasDatabase: boolean;
  autoCheckoutPlan?: "lifetime" | "monthly" | null;
}

export function DashboardClient({
  initialOverlay,
  user: initialUser,
  hasDatabase,
  autoCheckoutPlan = null,
}: DashboardClientProps) {
  const [user, setUser] = useState(initialUser);
  const [overlay, setOverlay] = useState<OverlayStateSnapshot>(initialOverlay);
  const [twitchChannel, setTwitchChannel] = useState(
    initialOverlay.twitchChannel ?? ""
  );
  const [kickChannel, setKickChannel] = useState(
    initialOverlay.kickChannel ?? ""
  );
  const [hookBanner, setHookBanner] = useState(
    initialOverlay.hookBanner ?? ""
  );
  const [savingHook, setSavingHook] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingChannels, setSavingChannels] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const obsUrl = `${origin}/overlay/${overlay.publicKey}`;

  const webhookUrls = useMemo(
    () => [
      {
        id: "wasted",
        label: "Wasted +1",
        url: `${origin}/api/trigger/${overlay.secretTriggerKey}?action=wasted`,
      },
      {
        id: "busted",
        label: "Busted +1",
        url: `${origin}/api/trigger/${overlay.secretTriggerKey}?action=busted`,
      },
      {
        id: "cash",
        label: "Add $5,000 Cash",
        url: `${origin}/api/trigger/${overlay.secretTriggerKey}?action=cash&amount=5000`,
      },
      {
        id: "undo",
        label: "Undo Wasted",
        url: `${origin}/api/trigger/${overlay.secretTriggerKey}?action=undo_wasted`,
      },
    ],
    [origin, overlay.secretTriggerKey]
  );

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const updateOverlay = async (patch: Record<string, unknown>) => {
    const res = await fetch("/api/overlay/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = (await res.json()) as { overlay?: OverlayStateSnapshot };
      if (data.overlay) {
        setOverlay(data.overlay);
      }
    }
  };

  const handleSaveChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingChannels(true);
    setStatusMessage(null);
    await updateOverlay({
      twitchChannel: twitchChannel.trim(),
      kickChannel: kickChannel.trim(),
    });
    setSavingChannels(false);
    setStatusMessage("Chat channels saved.");
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleRegenerateSecret = async () => {
    setRegenerating(true);
    try {
      const res = await fetch("/api/overlay/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_secret" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { secretTriggerKey?: string };
        if (data.secretTriggerKey) {
          setOverlay((prev) => ({
            ...prev,
            secretTriggerKey: data.secretTriggerKey!,
          }));
          setStatusMessage("Stream Deck webhook key rotated.");
          setTimeout(() => setStatusMessage(null), 2500);
        }
      }
    } finally {
      setRegenerating(false);
    }
  };

  const themes: Array<{
    id: HudTheme;
    name: string;
    desc: string;
    proOnly: boolean;
  }> = [
    {
      id: "sunset-broadcast",
      name: "Sunset Broadcast",
      desc: "Warm coral and golden amber dusk telemetry.",
      proOnly: false,
    },
    {
      id: "minimal-glass",
      name: "Minimal Glass",
      desc: "Smoked translucent plates with crisp white highlights.",
      proOnly: true,
    },
    {
      id: "tactical-dark",
      name: "Tactical Dark",
      desc: "High-contrast obsidian panels with amber indicators.",
      proOnly: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F4F5F7] flex flex-col overflow-x-hidden">
      <TopNav activePath="/dashboard" isSignedIn />

      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-3.5 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6">
        {!hasDatabase && (
          <div className="rounded-xl bg-[#F7B267]/12 border border-[#F7B267]/30 px-4 py-3 text-xs sm:text-sm text-[#F7B267]">
            Local development store active. Set DATABASE_URL in .env.local and
            run npx drizzle-kit push for Neon Postgres persistence.
          </div>
        )}

        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="font-hud font-extrabold text-2xl sm:text-3xl lg:text-4xl uppercase tracking-wide leading-tight">
              BROADCASTER SETUP HUB
            </h1>
            <p className="text-xs sm:text-sm text-[#8D96A5] break-words">
              Signed in as{" "}
              <span className="text-[#F4F5F7]/90 break-all">{user.email}</span>{" "}
              | Plan:{" "}
              <span className="font-bold text-[#F4F5F7] uppercase">
                {user.plan}
              </span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 shrink-0">
            <Link
              href="/remote"
              className="h-10 px-4 rounded-xl bg-[#2EC4B6] text-[#0B0D12] font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 hover:bg-[#2EC4B6]/90"
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Launch Mobile Remote</span>
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="h-10 px-3.5 rounded-xl bg-[#131720] border border-white/10 text-[#8D96A5] hover:text-[#F4F5F7] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="rounded-xl bg-[#2EC4B6]/15 border border-[#2EC4B6]/35 px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#2EC4B6]">
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* Left Column: OBS URL, Stream Deck Webhooks, Channels */}
          <div className="lg:col-span-7 min-w-0 space-y-5 sm:space-y-6">
            {/* OBS Browser Source Card */}
            <section className="broadcast-card rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-[#F25C54]/15 border border-[#F25C54]/30 flex items-center justify-center text-[#F25C54]">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-hud font-extrabold text-lg sm:text-2xl uppercase tracking-wide leading-snug">
                      OBS Browser Source URL
                    </h2>
                    <p className="text-xs sm:text-sm text-[#8D96A5] leading-relaxed">
                      Add as a 1920x1080 Browser Source in OBS Studio above your
                      console capture card.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/overlay/${overlay.publicKey}`}
                  target="_blank"
                  className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B0D12] border border-white/12 px-3 py-2 text-xs font-bold text-[#F4F5F7] hover:border-[#F25C54]/50"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#F25C54]" />
                  <span>Open Overlay</span>
                </Link>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={obsUrl}
                  aria-label="OBS Browser Source URL"
                  className="w-full min-w-0 flex-1 h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3.5 text-xs sm:text-sm font-medium text-[#F4F5F7] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy("obs-url", obsUrl)}
                  className="w-full sm:w-auto h-11 px-4 rounded-xl bg-[#F25C54] text-[#0B0D12] font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shrink-0 hover:bg-[#F25C54]/90 cursor-pointer"
                >
                  {copiedId === "obs-url" ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy OBS URL</span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Stream Deck & Macro Webhooks */}
            <section className="broadcast-card rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-[#F7B267]/15 border border-[#F7B267]/30 flex items-center justify-center text-[#F7B267]">
                    <Webhook className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-hud font-extrabold text-lg sm:text-2xl uppercase tracking-wide leading-snug">
                      Stream Deck &amp; Macro Triggers
                    </h2>
                    <p className="text-xs sm:text-sm text-[#8D96A5] leading-relaxed">
                      Paste these links into Elgato Stream Deck (System Website,
                      GET in background) or any macro pad.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={regenerating}
                  onClick={() => void handleRegenerateSecret()}
                  className="w-full sm:w-auto shrink-0 h-9 px-3 rounded-xl bg-[#0B0D12] border border-white/12 hover:border-[#F7B267]/50 text-xs font-bold text-[#F7B267] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`}
                  />
                  <span>Regenerate Key</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {webhookUrls.map((hook) => (
                  <div
                    key={hook.id}
                    className="rounded-xl bg-[#0B0D12] border border-white/8 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-[#F7B267]">
                        {hook.label}
                      </div>
                      <div className="text-xs text-[#8D96A5] truncate">
                        {hook.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopy(hook.id, hook.url)}
                      className="w-full sm:w-auto shrink-0 h-9 sm:h-8 px-3 rounded-lg bg-[#131720] border border-white/12 hover:border-white/30 text-xs font-bold text-[#F4F5F7] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === hook.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#2EC4B6]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Twitch & Kick Chat Channels */}
            <section className="broadcast-card rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-[#2EC4B6]/15 border border-[#2EC4B6]/30 flex items-center justify-center text-[#2EC4B6]">
                  <Tv className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-hud font-extrabold text-lg sm:text-2xl uppercase tracking-wide leading-snug">
                    Live Chat Poll Channels
                  </h2>
                  <p className="text-xs sm:text-sm text-[#8D96A5] leading-relaxed">
                    Reads !A, !B, 1, or 2 votes while your Mobile Remote or OBS
                    Dock is open.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveChannels} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8D96A5] mb-1.5">
                    Twitch Channel Username
                  </label>
                  <input
                    type="text"
                    value={twitchChannel}
                    onChange={(e) => setTwitchChannel(e.target.value)}
                    placeholder="e.g. vicebroadcaster"
                    className="w-full min-w-0 h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5]"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8D96A5] mb-1.5">
                    Kick Channel or Chatroom ID
                  </label>
                  <input
                    type="text"
                    value={kickChannel}
                    onChange={(e) => setKickChannel(e.target.value)}
                    placeholder="e.g. channel slug or 668"
                    className="w-full min-w-0 h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5]"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingChannels}
                    className="w-full sm:w-auto h-10 px-5 rounded-xl bg-[#2EC4B6] text-[#0B0D12] font-extrabold text-xs sm:text-sm hover:bg-[#2EC4B6]/90 cursor-pointer"
                  >
                    {savingChannels ? "Saving..." : "Save Chat Channels"}
                  </button>
                </div>
              </form>
            </section>
          </div>

          {/* Right Column: Live Preview, Widget Toggles, Theme Selector, Billing */}
          <div className="lg:col-span-5 min-w-0 space-y-5 sm:space-y-6">
            {/* Live Preview */}
            <section className="broadcast-card rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
                  Live HUD Preview
                </span>
                <span className="text-xs font-semibold text-[#2EC4B6]">
                  Theme: {overlay.theme}
                </span>
              </div>
              <div className="w-full rounded-xl overflow-hidden bg-gradient-to-br from-[#191E2B] via-[#131720] to-[#0B0D12] border border-white/10">
                <ScaledHudPreview state={overlay} />
              </div>
            </section>

            {/* Modular Widget Toggles */}
            <section className="broadcast-card rounded-2xl p-4 sm:p-5 space-y-3">
              <h2 className="font-hud font-extrabold text-lg sm:text-2xl uppercase tracking-wide leading-snug">
                Active Corner Widgets
              </h2>
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2.5">
                {[
                  {
                    key: "showStoryWidget" as const,
                    label: "Story Progress",
                    pos: "Top Left",
                    proOnly: false,
                  },
                  {
                    key: "showDeathWidget" as const,
                    label: "Wasted & Busted",
                    pos: "Bottom Left",
                    proOnly: false,
                  },
                  {
                    key: "showCashWidget" as const,
                    label: "Cash Ticker",
                    pos: "Top Right",
                    proOnly: true,
                  },
                  {
                    key: "showPollWidget" as const,
                    label: "Chat Poll Card",
                    pos: "Bottom Right",
                    proOnly: true,
                  },
                ].map((item) => {
                  const locked = item.proOnly && user.plan !== "pro";
                  const enabled = !locked && overlay[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        if (locked) return;
                        const nextVal = !enabled;
                        setOverlay((prev) => ({ ...prev, [item.key]: nextVal }));
                        void updateOverlay({ [item.key]: nextVal });
                      }}
                      className={`rounded-xl p-3 text-left border transition-all min-w-0 ${
                        locked
                          ? "bg-[#0B0D12] border-white/8 opacity-55 cursor-not-allowed"
                          : enabled
                            ? "bg-[#2EC4B6]/10 border-[#2EC4B6]/40 cursor-pointer"
                            : "bg-[#0B0D12] border-white/8 opacity-65 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-[#F4F5F7] leading-tight">
                          {item.label}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                            locked
                              ? "bg-[#F7B267]/15 text-[#F7B267]"
                              : enabled
                                ? "bg-[#2EC4B6] text-[#0B0D12]"
                                : "bg-white/10 text-[#8D96A5]"
                          }`}
                        >
                          {locked ? "PRO" : enabled ? "ON" : "OFF"}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8D96A5] mt-1">
                        {item.pos}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 9:16 Clip-Safe Mode + Top Hook Banner */}
            <section className="broadcast-card rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <SmartphoneNfc className="w-4 h-4 shrink-0 text-[#2EC4B6]" />
                  <h2 className="font-hud font-extrabold text-lg sm:text-2xl uppercase tracking-wide leading-snug">
                    9:16 Clip-Safe Mode
                  </h2>
                </div>
                {user.plan !== "pro" ? (
                  <span className="shrink-0 text-[10px] font-extrabold px-2 py-1 rounded bg-[#F7B267]/15 text-[#F7B267]">
                    PRO
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !overlay.clipSafeMode;
                      setOverlay((prev) => ({
                        ...prev,
                        clipSafeMode: nextVal,
                      }));
                      void updateOverlay({ clipSafeMode: nextVal });
                    }}
                    className={`shrink-0 h-8 px-3 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                      overlay.clipSafeMode
                        ? "bg-[#2EC4B6] text-[#0B0D12]"
                        : "bg-[#0B0D12] border border-white/15 text-[#8D96A5]"
                    }`}
                  >
                    {overlay.clipSafeMode ? "9:16 ON" : "16:9 WIDE"}
                  </button>
                )}
              </div>

              <p className="text-xs sm:text-sm text-[#8D96A5] leading-relaxed">
                Center all HUD widgets inside a vertical 9:16 safe window for
                TikTok, Reels, and Whop clips, with an optional Top Hook Banner.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (user.plan !== "pro") return;
                  setSavingHook(true);
                  await updateOverlay({ hookBanner: hookBanner.trim() || null });
                  setSavingHook(false);
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  maxLength={80}
                  disabled={user.plan !== "pro"}
                  value={hookBanner}
                  onChange={(e) => setHookBanner(e.target.value)}
                  placeholder="Top Hook Banner (e.g. WAIT FOR THE ENDING)"
                  className="w-full min-w-0 flex-1 h-10 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-xs sm:text-sm text-[#F4F5F7] placeholder:text-[#8D96A5] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={user.plan !== "pro" || savingHook}
                  className="w-full sm:w-auto h-10 px-4 rounded-xl bg-[#2EC4B6] text-[#0B0D12] font-bold text-xs sm:text-sm shrink-0 disabled:opacity-45 cursor-pointer"
                >
                  {savingHook ? "Saving..." : "Save Banner"}
                </button>
              </form>
            </section>

            {/* Theme Selector */}
            <section className="broadcast-card rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Palette className="w-4 h-4 shrink-0 text-[#F7B267]" />
                  <h2 className="font-hud font-extrabold text-lg sm:text-2xl uppercase tracking-wide leading-snug">
                    HUD Broadcast Theme
                  </h2>
                </div>
                {user.plan === "free" && (
                  <span className="shrink-0 text-[11px] font-bold text-[#F7B267]">
                    PRO UNLOCKS ALL
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {themes.map((t) => {
                  const locked = t.proOnly && user.plan === "free";
                  const selected = overlay.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        if (locked) return;
                        setOverlay((prev) => ({ ...prev, theme: t.id }));
                        void updateOverlay({ theme: t.id });
                      }}
                      className={`w-full text-left rounded-xl p-3 border transition-all flex items-center justify-between gap-3 ${
                        selected
                          ? "bg-[#F25C54]/12 border-[#F25C54]/50"
                          : "bg-[#0B0D12] border-white/8 hover:border-white/20"
                      } disabled:opacity-50`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#F4F5F7]">
                          {t.name}
                        </div>
                        <div className="text-xs text-[#8D96A5] leading-relaxed">
                          {t.desc}
                        </div>
                      </div>
                      {locked ? (
                        <span className="shrink-0 text-[10px] font-extrabold px-2 py-1 rounded bg-[#F7B267]/15 text-[#F7B267]">
                          PRO
                        </span>
                      ) : selected ? (
                        <span className="shrink-0 text-[10px] font-extrabold px-2 py-1 rounded bg-[#F25C54] text-[#0B0D12]">
                          ACTIVE
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Billing & Plan */}
            <section className="broadcast-card rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound className="w-4 h-4 shrink-0 text-[#F25C54]" />
                <h2 className="font-hud font-extrabold text-lg sm:text-2xl uppercase tracking-wide leading-snug">
                  Broadcaster Plan
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#8D96A5] leading-relaxed">
                {user.plan === "pro"
                  ? `Active Pro plan (${user.planType === "lifetime" ? "Launch Pass Lifetime" : user.subscriptionStatus}). Zero watermark, all 4 HUD widgets, Live Chat Polls, 9:16 Clip-Safe Mode, custom broadcast themes, and custom chapter checklists unlocked.`
                  : "Starter Free includes the Story Progress Bar and Wasted/Busted Counter plus Mobile Remote access with a bottom-corner LEONIDAHUD.COM watermark. Upgrade to Pro to remove branding and unlock Cash Ticker, Live Chat Polls, 9:16 Clip-Safe Mode, and custom themes."}
              </p>
              <PaddleUpgradeButtons
                userId={user.id}
                userEmail={user.email}
                currentPlan={user.plan}
                autoCheckoutPlan={autoCheckoutPlan}
                onUpgraded={() => {
                  setUser((prev) => ({ ...prev, plan: "pro" }));
                  setOverlay((prev) => ({ ...prev, plan: "pro" }));
                }}
              />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
