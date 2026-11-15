"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Crown, Sparkles } from "lucide-react";

interface PaddleUpgradeButtonsProps {
  userId?: string;
  userEmail?: string;
  currentPlan: "free" | "pro";
  compact?: boolean;
  showTrustFooter?: boolean;
}

export function PaddleUpgradeButtons({
  userId,
  userEmail,
  currentPlan,
  compact = false,
  showTrustFooter = true,
}: PaddleUpgradeButtonsProps) {
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const paddleEnv =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? "production"
      : "sandbox";
  const monthlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID;
  const launchPassPriceId = process.env.NEXT_PUBLIC_PADDLE_LAUNCH_PASS_PRICE_ID;

  useEffect(() => {
    if (!clientToken || paddle?.Initialized) return;
    initializePaddle({
      token: clientToken,
      environment: paddleEnv,
    }).then((instance) => {
      if (instance) setPaddle(instance);
    });
  }, [clientToken, paddleEnv, paddle?.Initialized]);

  const openCheckout = (priceId: string | undefined, label: string) => {
    if (!userId) {
      router.push("/signin?callbackUrl=/dashboard");
      return;
    }
    if (!paddle || !priceId) {
      setNotice(
        `Configure NEXT_PUBLIC_PADDLE_CLIENT_TOKEN and ${label} price ID in .env.local to open live Paddle Checkout.`
      );
      return;
    }
    setNotice(null);
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(userEmail ? { customer: { email: userEmail } } : {}),
      customData: { userId },
      settings: {
        variant: "one-page",
        theme: "dark",
        successUrl: `${window.location.origin}/dashboard?upgraded=1`,
      },
    });
  };

  if (currentPlan === "pro") {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-[#2EC4B6]/15 border border-[#2EC4B6]/35 px-4 py-2 text-sm font-bold text-[#2EC4B6]">
        <Crown className="w-4 h-4" />
        <span>PRO BROADCASTER ACTIVE</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() =>
          openCheckout(
            launchPassPriceId,
            "NEXT_PUBLIC_PADDLE_LAUNCH_PASS_PRICE_ID"
          )
        }
        className={`w-full ${
          compact ? "h-11" : "h-12"
        } px-5 rounded-xl bg-[#F25C54] hover:bg-[#F25C54]/90 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer`}
      >
        <Sparkles className="w-4 h-4" />
        <span>Unlock Launch Pass ($49)</span>
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() =>
            openCheckout(
              monthlyPriceId,
              "NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID"
            )
          }
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
