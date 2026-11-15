import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  Environment,
  LogLevel,
  Paddle,
  EventName,
} from "@paddle/paddle-node-sdk";
import { updateUserPlanFromPaddle } from "@/lib/overlay-service";
import type { UserPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

function verifyPaddleSignatureFallback(
  rawBody: string,
  secret: string,
  signatureHeader: string
): boolean {
  const parts = signatureHeader.split(";").reduce<Record<string, string>>(
    (acc, part) => {
      const [key, val] = part.split("=");
      if (key && val) acc[key.trim()] = val.trim();
      return acc;
    },
    {}
  );

  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  // Reject stale replay signatures older than 10 minutes
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
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

interface ParsedWebhookPayload {
  eventId: string;
  eventType: string;
  customerId: string | null;
  subscriptionId: string | null;
  status: string;
  userId: string | null;
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

async function parseAndVerifyWebhook(
  rawBody: string,
  secret: string,
  signature: string
): Promise<ParsedWebhookPayload> {
  if (process.env.PADDLE_API_KEY) {
    const paddle = new Paddle(process.env.PADDLE_API_KEY, {
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
          ? Environment.production
          : Environment.sandbox,
      logLevel: LogLevel.error,
    });
    const event = await paddle.webhooks.unmarshal(rawBody, secret, signature);
    const data = event.data as unknown as Record<string, unknown>;
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      customerId:
        typeof data.customerId === "string" ? data.customerId : null,
      subscriptionId:
        event.eventType.startsWith("subscription.") && typeof data.id === "string"
          ? data.id
          : typeof data.subscriptionId === "string"
          ? data.subscriptionId
          : null,
      status: typeof data.status === "string" ? data.status : "active",
      userId: extractCustomUserId(data.customData),
    };
  }

  const valid = verifyPaddleSignatureFallback(rawBody, secret, signature);
  if (!valid) {
    throw new Error("Invalid Paddle webhook signature");
  }

  const parsed = JSON.parse(rawBody) as {
    event_id?: string;
    event_type?: string;
    data?: Record<string, unknown>;
  };

  const data = parsed.data ?? {};
  const eventType = parsed.event_type ?? "";
  return {
    eventId: parsed.event_id ?? crypto.randomUUID(),
    eventType,
    customerId:
      typeof data.customer_id === "string" ? data.customer_id : null,
    subscriptionId:
      eventType.startsWith("subscription.") && typeof data.id === "string"
        ? data.id
        : typeof data.subscription_id === "string"
        ? data.subscription_id
        : null,
    status: typeof data.status === "string" ? data.status : "active",
    userId: extractCustomUserId(data.custom_data),
  };
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET ?? "";

  if (!signature || !rawBody || !secret) {
    return Response.json(
      { error: "Missing signature, body, or webhook secret" },
      { status: 400 }
    );
  }

  try {
    const event = await parseAndVerifyWebhook(rawBody, secret, signature);

    let plan: UserPlan | null = null;
    let subscriptionStatus = event.status;

    switch (event.eventType) {
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionCreated: {
        plan = "pro";
        subscriptionStatus = event.status || "active";
        break;
      }
      case EventName.SubscriptionUpdated: {
        const activeLike =
          event.status === "active" ||
          event.status === "trialing" ||
          event.status === "past_due";
        plan = activeLike ? "pro" : "free";
        subscriptionStatus = event.status || "updated";
        break;
      }
      case EventName.SubscriptionCanceled: {
        plan = "free";
        subscriptionStatus = "canceled";
        break;
      }
      case EventName.TransactionCompleted: {
        if (event.status === "completed" || event.status === "paid" || !event.status) {
          plan = "pro";
          subscriptionStatus = event.subscriptionId ? "active" : "launch_pass";
        }
        break;
      }
      default:
        break;
    }

    if (plan) {
      await updateUserPlanFromPaddle({
        eventId: event.eventId,
        eventType: event.eventType,
        userId: event.userId,
        paddleCustomerId: event.customerId,
        paddleSubscriptionId: event.subscriptionId,
        plan,
        subscriptionStatus,
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Paddle webhook error:", error);
    return Response.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
