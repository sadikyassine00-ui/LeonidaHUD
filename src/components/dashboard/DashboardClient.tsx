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
    subscriptionStatus: string;
  };
  hasDatabase: boolean;
}

export function DashboardClient({
  initialOverlay,
  user,
  hasDatabase,
}: DashboardClientProps) {
  const [overlay, setOverlay] = useState<OverlayStateSnapshot>(initialOverlay);
  const [twitchChannel, setTwitchChannel] = useState(
    initialOverlay.twitchChannel ?? ""
  );
  const [kickChannel, setKickChannel] = useState(
    initialOverlay.kickChannel ?? ""
  );
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
    <div className="min-h-screen bg-[#0B0D12] text-[#F4F5F7] flex flex-col">
      <TopNav activePath="/dashboard" isSignedIn />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {!hasDatabase && (
          <div className="rounded-xl bg-[#F7B267]/12 border border-[#F7B267]/30 px-4 py-3 text-xs sm:text-sm text-[#F7B267]">
            Local development store active. Set DATABASE_URL in .env.local and
            run npx drizzle-kit push for Neon Postgres persistence.
          </div>
        )}

        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-hud font-extrabold text-4xl uppercase tracking-wide">
              BROADCASTER SETUP HUB
            </h1>
            <p className="text-sm text-[#8D96A5]">
              Signed in as {user.email} | Plan:{" "}
              <span className="font-bold text-[#F4F5F7] uppercase">
                {user.plan}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/remote"
              className="h-10 px-4 rounded-xl bg-[#2EC4B6] text-[#0B0D12] font-extrabold text-sm inline-flex items-center gap-2 hover:bg-[#2EC4B6]/90"
            >
              <Smartphone className="w-4 h-4" />
              <span>Launch Mobile Remote</span>
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="h-10 px-3.5 rounded-xl bg-[#131720] border border-white/10 text-[#8D96A5] hover:text-[#F4F5F7] text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="rounded-xl bg-[#2EC4B6]/15 border border-[#2EC4B6]/35 px-4 py-2.5 text-sm font-semibold text-[#2EC4B6]">
            {statusMessage}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: OBS URL, Stream Deck Webhooks, Channels */}
          <div className="lg:col-span-7 space-y-6">
            {/* OBS Browser Source Card */}
            <section className="broadcast-card rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#F25C54]/15 border border-[#F25C54]/30 flex items-center justify-center text-[#F25C54]">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-hud font-extrabold text-2xl uppercase tracking-wide">
                      OBS Browser Source URL
                    </h2>
                    <p className="text-xs text-[#8D96A5]">
                      Add as a 1920x1080 Browser Source in OBS Studio above your
                      console capture card.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/overlay/${overlay.publicKey}`}
                  target="_blank"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#0B0D12] border border-white/12 px-3 py-2 text-xs font-bold text-[#F4F5F7] hover:border-[#F25C54]/50"
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
                  className="flex-1 h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3.5 text-sm font-medium text-[#F4F5F7] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy("obs-url", obsUrl)}
                  className="h-11 px-4 rounded-xl bg-[#F25C54] text-[#0B0D12] font-extrabold text-sm inline-flex items-center justify-center gap-2 shrink-0 hover:bg-[#F25C54]/90"
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
            <section className="broadcast-card rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#F7B267]/15 border border-[#F7B267]/30 flex items-center justify-center text-[#F7B267]">
                    <Webhook className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-hud font-extrabold text-2xl uppercase tracking-wide">
                      Stream Deck &amp; Macro Triggers
                    </h2>
                    <p className="text-xs text-[#8D96A5]">
                      Paste these links into Elgato Stream Deck (System Website,
                      GET in background) or any macro pad.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={regenerating}
                  onClick={() => void handleRegenerateSecret()}
                  className="shrink-0 h-9 px-3 rounded-xl bg-[#0B0D12] border border-white/12 hover:border-[#F7B267]/50 text-xs font-bold text-[#F7B267] inline-flex items-center gap-1.5"
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
                    className="rounded-xl bg-[#0B0D12] border border-white/8 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#F7B267]">
                        {hook.label}
                      </div>
                      <div className="text-xs text-[#8D96A5] truncate">
                        {hook.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopy(hook.id, hook.url)}
                      className="shrink-0 h-8 px-3 rounded-lg bg-[#131720] border border-white/12 hover:border-white/30 text-xs font-bold text-[#F4F5F7] inline-flex items-center gap-1.5"
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
            <section className="broadcast-card rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#2EC4B6]/15 border border-[#2EC4B6]/30 flex items-center justify-center text-[#2EC4B6]">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-hud font-extrabold text-2xl uppercase tracking-wide">
                    Live Chat Poll Channels
                  </h2>
                  <p className="text-xs text-[#8D96A5]">
                    Reads !A, !B, 1, or 2 votes while your Mobile Remote or OBS
                    Dock is open.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveChannels} className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8D96A5] mb-1.5">
                    Twitch Channel Username
                  </label>
                  <input
                    type="text"
                    value={twitchChannel}
                    onChange={(e) => setTwitchChannel(e.target.value)}
                    placeholder="e.g. vicebroadcaster"
                    className="w-full h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8D96A5] mb-1.5">
                    Kick Channel or Chatroom ID
                  </label>
                  <input
                    type="text"
                    value={kickChannel}
                    onChange={(e) => setKickChannel(e.target.value)}
                    placeholder="e.g. channel slug or 668"
                    className="w-full h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5]"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingChannels}
                    className="h-10 px-5 rounded-xl bg-[#2EC4B6] text-[#0B0D12] font-extrabold text-sm hover:bg-[#2EC4B6]/90"
                  >
                    {savingChannels ? "Saving..." : "Save Chat Channels"}
                  </button>
                </div>
              </form>
            </section>
          </div>

          {/* Right Column: Live Preview, Widget Toggles, Theme Selector, Billing */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Preview */}
            <section className="broadcast-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
                  Live HUD Preview
                </span>
                <span className="text-xs font-semibold text-[#2EC4B6]">
                  Theme: {overlay.theme}
                </span>
              </div>
              <div className="rounded-xl overflow-hidden bg-gradient-to-br from-[#191E2B] via-[#131720] to-[#0B0D12] border border-white/10">
                <ScaledHudPreview state={overlay} />
              </div>
            </section>

            {/* Modular Widget Toggles */}
            <section className="broadcast-card rounded-2xl p-5 space-y-3">
              <h2 className="font-hud font-extrabold text-2xl uppercase tracking-wide">
                Active Corner Widgets
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {
                    key: "showStoryWidget" as const,
                    label: "Story Progress",
                    pos: "Top Left",
                  },
                  {
                    key: "showCashWidget" as const,
                    label: "Cash Ticker",
                    pos: "Top Right",
                  },
                  {
                    key: "showDeathWidget" as const,
                    label: "Wasted & Busted",
                    pos: "Bottom Left",
                  },
                  {
                    key: "showPollWidget" as const,
                    label: "Chat Poll Card",
                    pos: "Bottom Right",
                  },
                ].map((item) => {
                  const enabled = overlay[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        const nextVal = !enabled;
                        setOverlay((prev) => ({ ...prev, [item.key]: nextVal }));
                        void updateOverlay({ [item.key]: nextVal });
                      }}
                      className={`rounded-xl p-3 text-left border transition-all ${
                        enabled
                          ? "bg-[#2EC4B6]/10 border-[#2EC4B6]/40"
                          : "bg-[#0B0D12] border-white/8 opacity-65"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F4F5F7]">
                          {item.label}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                            enabled
                              ? "bg-[#2EC4B6] text-[#0B0D12]"
                              : "bg-white/10 text-[#8D96A5]"
                          }`}
                        >
                          {enabled ? "ON" : "OFF"}
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

            {/* Theme Selector */}
            <section className="broadcast-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#F7B267]" />
                  <h2 className="font-hud font-extrabold text-2xl uppercase tracking-wide">
                    HUD Broadcast Theme
                  </h2>
                </div>
                {user.plan === "free" && (
                  <span className="text-[11px] font-bold text-[#F7B267]">
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
                      <div>
                        <div className="text-sm font-bold text-[#F4F5F7]">
                          {t.name}
                        </div>
                        <div className="text-xs text-[#8D96A5]">{t.desc}</div>
                      </div>
                      {locked ? (
                        <span className="text-[10px] font-extrabold px-2 py-1 rounded bg-[#F7B267]/15 text-[#F7B267]">
                          PRO
                        </span>
                      ) : selected ? (
                        <span className="text-[10px] font-extrabold px-2 py-1 rounded bg-[#F25C54] text-[#0B0D12]">
                          ACTIVE
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Billing & Plan */}
            <section className="broadcast-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#F25C54]" />
                <h2 className="font-hud font-extrabold text-2xl uppercase tracking-wide">
                  Broadcaster Plan
                </h2>
              </div>
              <p className="text-xs text-[#8D96A5]">
                {user.plan === "pro"
                  ? `Active Pro plan (${user.subscriptionStatus}). Zero watermark, custom broadcast themes, custom chapter checklists, and unlimited Stream Deck triggers unlocked.`
                  : "Starter Free includes all 4 HUD widgets, Mobile Remote, Stream Deck triggers, and live chat polls with a bottom-corner LEONIDAHUD.COM watermark. Upgrade to Pro to remove branding and unlock custom themes."}
              </p>
              <PaddleUpgradeButtons
                userId={user.id}
                userEmail={user.email}
                currentPlan={user.plan}
              />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
