import { auth } from "@/auth";
import { hasDatabaseConfig } from "@/db";
import { DEMO_USER_ID } from "@/lib/overlay-service";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  // Only bypass auth in local dev without DB when ENABLE_DEMO_AUTH is explicitly "true"
  if (!hasDatabaseConfig() && process.env.ENABLE_DEMO_AUTH === "true") {
    return DEMO_USER_ID;
  }

  return null;
}

export function getAuthProviderFlags(): {
  twitch: boolean;
  discord: boolean;
  email: boolean;
  emailProvider: "resend" | "nodemailer" | null;
  demo: boolean;
} {
  const hasDb = hasDatabaseConfig();
  const emailProvider: "resend" | "nodemailer" | null = hasDb
    ? process.env.AUTH_RESEND_KEY
      ? "resend"
      : process.env.EMAIL_SERVER && process.env.EMAIL_FROM
        ? "nodemailer"
        : null
    : null;

  return {
    twitch: Boolean(
      process.env.AUTH_TWITCH_ID && process.env.AUTH_TWITCH_SECRET
    ),
    discord: Boolean(
      process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET
    ),
    email: Boolean(emailProvider),
    emailProvider,
    demo: process.env.ENABLE_DEMO_AUTH === "true",
  };
}
