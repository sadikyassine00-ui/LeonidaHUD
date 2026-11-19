"use client";

import React, { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Mail,
  MessageSquare,
  Sparkles,
  Tv,
} from "lucide-react";

interface SignInFormProps {
  callbackUrl: string;
  checkoutPlan?: "lifetime" | "monthly" | null;
  authError?: string | null;
  authReason?: string | null;
  providers: {
    twitch: boolean;
    discord: boolean;
    email: boolean;
    emailProvider: "resend" | "nodemailer" | null;
    demo: boolean;
  };
}

function getFriendlyAuthError(
  code: string | null | undefined,
  reason?: string | null
): string | null {
  if (!code) return null;
  switch (code) {
    case "OAuthAccountNotLinked":
      return "An account with that email already exists under another sign-in method. Sign in with that method or try again.";
    case "Verification":
      return "That magic login link has expired or was already used. Request a fresh link below.";
    case "AccessDenied":
      return "Sign-in was canceled or denied by the provider.";
    case "Configuration": {
      const normalized = (reason ?? "").toLowerCase();
      let detail =
        "Your sign-in session could not be verified with Twitch or Discord. Please retry from this page or use your other broadcaster account.";
      if (normalized.includes("access_denied")) {
        detail =
          "Sign-in was canceled or denied by your provider. Please try again when ready.";
      } else if (
        normalized.includes("rate_limited") ||
        normalized.includes("_429")
      ) {
        detail =
          "The sign-in provider is temporarily rate-limiting requests. Wait a moment and try again, or use your other broadcaster account.";
      } else if (normalized.includes("redirect_uri")) {
        detail =
          "The provider rejected the callback address for this site. Verify the redirect URL matches https://www.leonidahud.com/api/auth/callback/twitch or /discord.";
      } else if (normalized.includes("invalid_client")) {
        detail =
          "The provider rejected the app credentials. Please check the configured client ID and secret.";
      } else if (normalized.includes("invalid_grant")) {
        detail =
          "Your sign-in code expired or was already used. Please try signing in again from this page.";
      } else if (
        normalized === "pkce_missing" ||
        normalized.includes("state_mismatch")
      ) {
        detail =
          "Your browser security cookie expired or did not match the domain. Refresh this page and try signing in again from https://www.leonidahud.com.";
      } else if (normalized.startsWith("adapter_error")) {
        detail =
          "We could not save your broadcaster profile yet. Please wait a moment and try again.";
      } else if (normalized.includes("profile_parse")) {
        detail =
          "Your provider returned an incomplete account profile. Please verify your email with Twitch or Discord, or try the other sign-in option.";
      }
      return reason ? `${detail} (Code: ${reason})` : detail;
    }
    default:
      return "Could not complete sign-in. Please try again.";
  }
}

export function SignInForm({
  callbackUrl,
  checkoutPlan = null,
  authError = null,
  authReason = null,
  providers,
}: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(() =>
    getFriendlyAuthError(authError, authReason)
  );

  const handleOAuth = async (provider: "twitch" | "discord") => {
    setFormError(null);
    setLoading(provider);
    await signIn(provider, { callbackUrl });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !providers.emailProvider) return;

    setFormError(null);
    setLoading("email");
    try {
      const result = await signIn(providers.emailProvider, {
        email: trimmed,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setFormError(getFriendlyAuthError(result.error));
      } else {
        setEmailSentTo(trimmed);
      }
    } catch {
      setFormError("Unable to send your magic login link right now. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleDemoSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading("demo");
    await signIn("demo-broadcaster", {
      email: demoEmail.trim() || "streamer@leonidahud.com",
      callbackUrl,
    });
  };

  return (
    <div className="w-full max-w-md broadcast-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-black/50">
      <div className="space-y-2 text-center">
        <Image
          src="/logos/leonida-hud-icon.png"
          alt="Leonida HUD"
          width={56}
          height={56}
          className="w-14 h-14 mx-auto rounded-2xl"
        />
        <h1 className="font-hud font-extrabold text-3xl tracking-wide uppercase text-[#F4F5F7]">
          BROADCASTER SIGN IN
        </h1>
        <p className="text-sm text-[#8D96A5]">
          Sign in to generate your private 1920x1080 OBS Browser Source and
          Mobile Remote controls.
        </p>
      </div>

      {checkoutPlan && (
        <div className="rounded-xl bg-[#F25C54]/12 border border-[#F25C54]/40 px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-[#F4F5F7]">
          <Sparkles className="w-4 h-4 text-[#F7B267] shrink-0" />
          <span>
            {checkoutPlan === "lifetime"
              ? "Sign in to continue directly to your $49 Pro Launch Pass checkout."
              : "Sign in to continue directly to your $29/mo Pro Broadcaster checkout."}
          </span>
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="rounded-xl bg-[#F25C54]/12 border border-[#F25C54]/45 px-4 py-3 flex items-start gap-2.5 text-xs font-medium text-[#F4F5F7]"
        >
          <AlertCircle className="w-4 h-4 text-[#F25C54] shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* OAuth Providers */}
      <div className="space-y-2.5">
        <button
          type="button"
          disabled={!providers.twitch || loading !== null}
          onClick={() => void handleOAuth("twitch")}
          className="w-full h-12 rounded-xl bg-[#181D29] border border-white/12 hover:border-[#F25C54]/60 text-[#F4F5F7] font-bold text-sm flex items-center justify-between px-4 transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="inline-flex items-center gap-2.5">
            <Tv className="w-4 h-4 text-[#F25C54]" />
            <span>
              {loading === "twitch"
                ? "Connecting to Twitch..."
                : "Continue with Twitch"}
            </span>
          </span>
          {!providers.twitch ? (
            <span className="text-[11px] font-semibold text-[#8D96A5]">
              Unavailable
            </span>
          ) : (
            <ArrowRight className="w-4 h-4 text-[#8D96A5]" />
          )}
        </button>

        <button
          type="button"
          disabled={!providers.discord || loading !== null}
          onClick={() => void handleOAuth("discord")}
          className="w-full h-12 rounded-xl bg-[#181D29] border border-white/12 hover:border-[#F7B267]/60 text-[#F4F5F7] font-bold text-sm flex items-center justify-between px-4 transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="inline-flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-[#F7B267]" />
            <span>
              {loading === "discord"
                ? "Connecting to Discord..."
                : "Continue with Discord"}
            </span>
          </span>
          {!providers.discord ? (
            <span className="text-[11px] font-semibold text-[#8D96A5]">
              Unavailable
            </span>
          ) : (
            <ArrowRight className="w-4 h-4 text-[#8D96A5]" />
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-white/10" />
        <span className="shrink mx-3 text-[11px] font-bold uppercase tracking-wider text-[#8D96A5]">
          Or continue with email
        </span>
        <div className="flex-grow border-t border-white/10" />
      </div>

      {/* Broadcaster Email Magic Link */}
      {emailSentTo ? (
        <div className="rounded-xl bg-[#2EC4B6]/12 border border-[#2EC4B6]/40 p-4 space-y-2.5 text-center">
          <CheckCircle2 className="w-6 h-6 text-[#2EC4B6] mx-auto" />
          <div className="text-sm font-bold text-[#F4F5F7]">
            Check your inbox for your magic login link
          </div>
          <p className="text-xs text-[#8D96A5]">
            We sent a one-time sign-in link to{" "}
            <span className="text-[#F4F5F7] font-semibold">{emailSentTo}</span>.
          </p>
          <button
            type="button"
            onClick={() => setEmailSentTo(null)}
            className="text-xs font-semibold text-[#2EC4B6] hover:underline cursor-pointer"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleEmailSignIn(e)} className="space-y-2.5">
          <label
            htmlFor="magic-email"
            className="block text-xs font-bold uppercase tracking-wider text-[#8D96A5]"
          >
            Broadcaster Email
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="magic-email"
              type="email"
              required
              disabled={!providers.email || loading !== null}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@stream.gg"
              className="flex-1 h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3.5 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5] focus:outline-none focus:border-[#2EC4B6] disabled:opacity-45"
            />
            <button
              type="submit"
              disabled={!providers.email || loading !== null}
              className="h-11 px-4 rounded-xl bg-[#2EC4B6] hover:bg-[#2EC4B6]/90 text-[#0B0D12] font-extrabold text-sm inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>
                {loading === "email" ? "Sending..." : "Send Magic Link"}
              </span>
            </button>
          </div>
          {!providers.email && (
            <p className="text-[11px] text-[#8D96A5]">
              Email Magic Links activate automatically once mail credentials are configured.
            </p>
          )}
        </form>
      )}

      {/* Strictly gated Demo Auth fallback (only rendered when ENABLE_DEMO_AUTH === "true") */}
      {providers.demo && (
        <form
          onSubmit={(e) => void handleDemoSignIn(e)}
          className="pt-4 border-t border-white/10 space-y-3"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#F7B267]">
            Quick Workspace Preview
          </div>
          <input
            type="email"
            value={demoEmail}
            onChange={(e) => setDemoEmail(e.target.value)}
            placeholder="streamer@leonidahud.com"
            aria-label="Preview Workspace Email"
            className="w-full h-11 rounded-xl bg-[#0B0D12] border border-white/10 px-3.5 text-sm text-[#F4F5F7] placeholder:text-[#8D96A5]"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="w-full h-11 rounded-xl bg-[#F25C54] hover:bg-[#F25C54]/90 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>
              {loading === "demo"
                ? "Signing In..."
                : checkoutPlan
                  ? "Sign In & Open Checkout"
                  : "Enter Preview Workspace"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
