import crypto from "crypto";
import { NextRequest } from "next/server";
import { EventName } from "@paddle/paddle-node-sdk";
import { updateUserPlanFromPaddle } from "@/lib/overlay-service";
import type { PlanType, UserPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

function verifyPaddleSignature(
  rawBody: string,
  secret: string,
  signatureHeader: string
): boolean {
  const parts = signatureHeader.split(";").reduce<Record<string, string>>(
    (acc, part) => {
      const idx = part.indexOf("=");
      if (idx > 0) {
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (key && val) acc[key] = val;
      }
      return acc;
    },
    {}
  );

  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  const tsSeconds = Number(ts);
  if (!Number.isFinite(tsSeconds)) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - tsSeconds);
  if (ageSeconds > 600) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}:${rawBody}`, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(h1, "hex");
  if (
    expectedBuf.length === 0 ||
    expectedBuf.length !== receivedBuf.length
  ) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

function extractCustomUserId(customData: unknown): string | null {
  if (!customData || typeof customData !== "object") return null;
  const record = customData as Record<string, unknown>;
  if (typeof record.userId === "string" && record.userId.trim()) {
    return record.userId.trim();
  }
  if (typeof record.user_id === "string" && record.user_id.trim()) {
    return record.user_id.trim();
  }
  return null;
}

function extractFirstPriceId(data: Record<string, unknown>): string | null {
  const items = Array.isArray(data.items) ? data.items : [];
  const first = items[0] as Record<string, unknown> | undefined;
  if (!first) return null;
  if (typeof first.price_id === "string") return first.price_id;
  if (first.price && typeof first.price === "object") {
    const p = first.price as Record<string, unknown>;
    if (typeof p.id === "string") return p.id;
  }
  return null;
}

async function fetchPaddleCustomerEmail(
  customerId: string | null
): Promise<string | null> {
  if (!customerId || !process.env.PADDLE_API_KEY) return null;
  const baseUrl =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? "https://api.paddle.com"
      : "https://sandbox-api.paddle.com";
  try {
    const res = await fetch(`${baseUrl}/customers/${customerId}`, {
      headers: {
        Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { email?: string } };
    return typeof json.data?.email === "string" ? json.data.email : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();
  const secret =
    process.env.PADDLE_WEBHOOK_SECRET ||
    process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET ||
    "";

  if (!signature || !rawBody || !secret) {
    return Response.json(
      { error: "Unauthorized webhook signature or secret missing" },
      { status: 401 }
    );
  }

  if (!verifyPaddleSignature(rawBody, secret, signature)) {
    return Response.json(
      { error: "Invalid Paddle webhook signature" },
      { status: 401 }
    );
  }

  try {
    const parsed = JSON.parse(rawBody) as {
      event_id?: string;
      event_type?: string;
      data?: Record<string, unknown>;
    };

    const eventId = parsed.event_id ?? crypto.randomUUID();
    const eventType = parsed.event_type ?? "";
    const data = parsed.data ?? {};

    const customerId =
      typeof data.customer_id === "string" ? data.customer_id : null;
    const subscriptionId =
      eventType.startsWith("subscription.") && typeof data.id === "string"
        ? data.id
        : typeof data.subscription_id === "string"
          ? data.subscription_id
          : null;
    const status = typeof data.status === "string" ? data.status : "active";
    const userId = extractCustomUserId(data.custom_data);
    const priceId = extractFirstPriceId(data);

    let customerEmail: string | null = null;
    if (data.customer && typeof data.customer === "object") {
      const cust = data.customer as Record<string, unknown>;
      if (typeof cust.email === "string") customerEmail = cust.email;
    }
    if (!customerEmail && !userId && customerId) {
      customerEmail = await fetchPaddleCustomerEmail(customerId);
    }

    const lifetimePriceId =
      process.env.NEXT_PUBLIC_PADDLE_PRICE_LIFETIME ||
      process.env.NEXT_PUBLIC_PADDLE_LAUNCH_PASS_PRICE_ID;
    const monthlyPriceId =
      process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY ||
      process.env.NEXT_PUBLIC_PADDLE_PRO_MONTHLY_PRICE_ID;

    let plan: UserPlan | null = null;
    let planType: PlanType | undefined;
    let subscriptionStatus = status;
    let isDowngrade = false;

    switch (eventType) {
      case EventName.TransactionCompleted:
      case "transaction.completed": {
        if (status === "completed" || status === "paid" || !status) {
          plan = "pro";
          if (priceId && lifetimePriceId && priceId === lifetimePriceId) {
            planType = "lifetime";
            subscriptionStatus = "launch_pass";
          } else if (priceId && monthlyPriceId && priceId === monthlyPriceId) {
            planType = "monthly";
            subscriptionStatus = "active";
          } else {
            planType = subscriptionId ? "monthly" : "lifetime";
            subscriptionStatus = subscriptionId ? "active" : "launch_pass";
          }
        }
        break;
      }
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionUpdated:
      case "subscription.activated":
      case "subscription.updated": {
        if (status === "active" || status === "trialing") {
          plan = "pro";
          planType = "monthly";
          subscriptionStatus = status;
        } else if (status === "past_due" || status === "canceled") {
          plan = "free";
          planType = "free";
          subscriptionStatus = status;
          isDowngrade = true;
        }
        break;
      }
      case EventName.SubscriptionCanceled:
      case EventName.SubscriptionPastDue:
      case "subscription.canceled":
      case "subscription.past_due": {
        plan = "free";
        planType = "free";
        subscriptionStatus =
          eventType === "subscription.past_due" ? "past_due" : "canceled";
        isDowngrade = true;
        break;
      }
      default:
        break;
    }

    if (plan) {
      await updateUserPlanFromPaddle({
        eventId,
        eventType,
        userId,
        customerEmail,
        paddleCustomerId: customerId,
        paddleSubscriptionId: subscriptionId,
        plan,
        planType,
        subscriptionStatus,
        isDowngrade,
      });
    }

    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Paddle webhook error:", error);
    return Response.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
