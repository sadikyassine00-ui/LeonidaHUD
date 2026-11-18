"use client";

import React, { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Mail, Tv, MessageSquare, ArrowRight, Sparkles } from "lucide-react";

interface SignInFormProps {
  callbackUrl: string;
  checkoutPlan?: "lifetime" | "monthly" | null;
  providers: {
    twitch: boolean;
    discord: boolean;
    email: boolean;
    demo: boolean;
  };
}

export function SignInForm({
  callbackUrl,
  checkoutPlan = null,
  providers,
}: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleOAuth = async (provider: "twitch" | "discord") => {
    setLoading(provider);
    await signIn(provider, { callbackUrl });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading("email");
    await signIn("nodemailer", {
      email: email.trim(),
      callbackUrl,
      redirect: false,
    });
    setEmailSent(true);
    setLoading(null);
  };

  const handleDemoSignIn = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading("demo");
    await signIn("demo-broadcaster", {
      email: email.trim() || "streamer@leonidahud.com",
      callbackUrl,
    });
  };

  return (
    <div className="w-full max-w-md broadcast-card rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="space-y-2 text-center">
        <Image
          src="/logos/leonida-hud-icon.png"
          alt="Leonida HUD"
          width={56}
          height={56}
          className="w-14 h-14 mx-auto rounded-2xl"
        />
        <h1 className="font-hud font-extrabold text-3xl tracking-wide uppercase text-[#F4F5F7]">
          BROADCAST SIGN IN
        </h1>
        <p className="text-sm text-[#8D96A5]">
          Connect your stream account to generate your private OBS Browser Source
          and Mobile Remote URLs.
        </p>
      </div>

      {checkoutPlan && (
        <div className="rounded-xl bg-[#F25C54]/12 border border-[#F25C54]/40 px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-[#F4F5F7]">
          <Sparkles className="w-4 h-4 text-[#F7B267] shrink-0" />
          <span>
            {checkoutPlan === "lifetime"
              ? "Sign in to continue to your $49 Pro Launch Pass checkout."
              : "Sign in to continue to your $29/mo Pro Broadcaster checkout."}
          </span>
        </div>
      )}

      {(providers.twitch || providers.discord) && (
        <div className="space-y-2.5">
          {providers.twitch && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void handleOAuth("twitch")}
              className="w-full h-12 rounded-xl bg-[#1C212E] border border-white/12 hover:border-[#F25C54]/50 text-[#F4F5F7] font-bold text-sm flex items-center justify-center gap-2.5 transition-colors disabled:opacity-45 cursor-pointer"
            >
              <Tv className="w-4 h-4 text-[#F25C54]" />
              <span>Continue with Twitch</span>
            </button>
          )}

          {providers.discord && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void handleOAuth("discord")}
              className="w-full h-12 rounded-xl bg-[#1C212E] border border-white/12 hover:border-[#F7B267]/50 text-[#F4F5F7] font-bold text-sm flex items-center justify-center gap-2.5 transition-colors disabled:opacity-45 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#F7B267]" />
              <span>Continue with Discord</span>
            </button>
          )}
        </div>
      )}

      {providers.email && (
        <form
          onSubmit={handleEmailSignIn}
          className="space-y-2.5 pt-2 border-t border-white/8"
        >
          <label className="block text-xs font-bold uppercase tracking-wider text-[#8D96A5]">
            Email Magic Link
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@stream.gg"
              className="flex-1 h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5]"
            />
            <button
              type="submit"
              disabled={loading !== null}
              className="h-11 px-4 rounded-xl bg-[#2EC4B6] text-[#0B0D12] font-bold text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
          {emailSent && (
            <p className="text-xs text-[#2EC4B6]">
              Magic link dispatched. Check your inbox to finish signing in.
            </p>
          )}
        </form>
      )}

      {providers.demo && (
        <form
          onSubmit={(e) => void handleDemoSignIn(e)}
          className="pt-3 border-t border-white/8 space-y-3"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="broadcaster-email"
              className="block text-xs font-bold uppercase tracking-wider text-[#8D96A5]"
            >
              Broadcaster Email
            </label>
            <input
              id="broadcaster-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="streamer@leonidahud.com"
              className="w-full h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5]"
            />
          </div>
          <button
            type="submit"
            disabled={loading !== null}
            className="w-full h-12 rounded-xl bg-[#F25C54] hover:bg-[#F25C54]/90 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>
              {loading === "demo"
                ? "Signing In..."
                : checkoutPlan
                  ? "Sign In & Open Checkout"
                  : "Continue to Broadcaster Hub"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
