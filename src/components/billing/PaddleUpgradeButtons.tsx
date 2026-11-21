"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Crown, Loader2, Sparkles } from "lucide-react";

interface UpgradedBillingPayload {
  plan?: string;
  planType?: "free" | "lifetime" | "monthly";
  subscriptionStatus?: string;
}

interface PaddleUpgradeButtonsProps {
  userId?: string;
  userEmail?: string;
  currentPlan: "free" | "pro";
  autoCheckoutPlan?: "lifetime" | "monthly" | null;
  justUpgraded?: boolean;
  compact?: boolean;
  showTrustFooter?: boolean;
  onUpgraded?: (billing?: UpgradedBillingPayload) => void;
}

export function PaddleUpgradeButtons({
  userId,
  userEmail,
  currentPlan,
  autoCheckoutPlan = null,
  justUpgraded = false,
  compact = false,
  showTrustFooter = true,
  onUpgraded,
}: PaddleUpgradeButtonsProps) {
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(currentPlan === "pro");
  const autoOpenedRef = useRef(false);
  const pollingRef = useRef(false);

  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const paddleEnv =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? "production"
      : "sandbox";
  const lifetimePriceId =
    process.env.NEXT_PUBLIC_PADDLE_PRICE_LIFETIME ||
    process.env.NEXT_PUBLIC_PADDLE_LAUNCH_PASS_PRICE_ID;
  const monthlyPriceId =
    process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY ||
    process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID;

  const pollUntilPro = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setActivating(true);
    setNotice(null);

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          const res = await fetch("/api/user/billing-status", {
            cache: "no-store",
          });
          if (res.ok) {
            const data = (await res.json()) as UpgradedBillingPayload;
            if (data.plan === "pro") {
              setActivated(true);
              setActivating(false);
              onUpgraded?.(data);
              router.refresh();
              return;
            }
          }
        } catch {
          // Retry next interval
        }
        await new Promise((r) => setTimeout(r, 1200));
      }

      setActivating(false);
      setNotice(
        "Payment received. If your Pro badge has not updated yet, refresh this page in a few seconds."
      );
      router.refresh();
    } finally {
      pollingRef.current = false;
    }
  }, [onUpgraded, router]);

  useEffect(() => {
    setActivated(currentPlan === "pro");
  }, [currentPlan]);

  useEffect(() => {
    if (justUpgraded && currentPlan !== "pro") {
      void pollUntilPro();
    }
  }, [justUpgraded, currentPlan, pollUntilPro]);

  useEffect(() => {
    if (!clientToken || paddle?.Initialized) return;
    initializePaddle({
      token: clientToken,
      environment: paddleEnv,
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          void pollUntilPro();
        }
      },
    }).then((instance) => {
      if (instance) setPaddle(instance);
    });
  }, [clientToken, paddleEnv, paddle?.Initialized, pollUntilPro]);

  const openCheckout = useCallback(
    (planKind: "lifetime" | "monthly") => {
      if (!userId) {
        router.push(`/signin?plan=${planKind}`);
        return;
      }

      const priceId =
        planKind === "lifetime" ? lifetimePriceId : monthlyPriceId;

      if (!paddle || !priceId) {
        setNotice(
          "Paddle Checkout is initializing or missing price configuration. Try again in a moment."
        );
        return;
      }

      setNotice(null);
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        ...(userEmail ? { customer: { email: userEmail } } : {}),
        customData: { userId: String(userId) },
        settings: {
          variant: "one-page",
          theme: "dark",
          successUrl: `${window.location.origin}/dashboard?upgraded=1`,
        },
      });
    },
    [lifetimePriceId, monthlyPriceId, paddle, router, userEmail, userId]
  );

  // Auto-open Paddle Checkout when redirected back from /signin?plan=...
  useEffect(() => {
    if (
      autoCheckoutPlan &&
      userId &&
      currentPlan !== "pro" &&
      paddle &&
      !autoOpenedRef.current
    ) {
      autoOpenedRef.current = true;
      openCheckout(autoCheckoutPlan);
    }
  }, [autoCheckoutPlan, currentPlan, openCheckout, paddle, userId]);

  if (activated || currentPlan === "pro") {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-[#2EC4B6]/15 border border-[#2EC4B6]/35 px-4 py-2 text-sm font-bold text-[#2EC4B6]">
        <Crown className="w-4 h-4" />
        <span>PRO BROADCASTER ACTIVE</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activating && (
        <div className="rounded-xl bg-[#2EC4B6]/15 border border-[#2EC4B6]/40 px-4 py-3 flex items-center gap-2.5 text-sm font-bold text-[#2EC4B6]">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Activating Pro Pass...</span>
        </div>
      )}

      <button
        type="button"
        disabled={activating}
        onClick={() => openCheckout("lifetime")}
        className={`w-full ${
          compact ? "h-11" : "h-12"
        } px-5 rounded-xl bg-[#F25C54] hover:bg-[#F25C54]/90 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer`}
      >
        <Sparkles className="w-4 h-4" />
        <span>Unlock Launch Pass ($49)</span>
      </button>

      <div className="text-center">
        <button
          type="button"
          disabled={activating}
          onClick={() => openCheckout("monthly")}
          className="text-[12px] text-[#8D96A5] hover:text-[#F4F5F7] hover:underline transition-colors cursor-pointer"
        >
          Prefer monthly billing? Start at $29/mo
        </button>
      </div>

      {showTrustFooter && (
        <p className="text-[12px] text-center text-[#8D96A5]">
          Instant OBS Browser Source access via Paddle. Works on PS5 &amp; Xbox
          capture setups.
        </p>
      )}

      {notice && (
        <p className="text-xs text-[#F7B267] bg-[#F7B267]/10 border border-[#F7B267]/25 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}
    </div>
  );
}
