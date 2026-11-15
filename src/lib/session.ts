import { auth } from "@/auth";
import { hasDatabaseConfig } from "@/db";
import { DEMO_USER_ID } from "@/lib/overlay-service";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  // In local dev without Neon DB configured, allow immediate access to the demo broadcaster workspace
  if (!hasDatabaseConfig() && process.env.NODE_ENV !== "production") {
    return DEMO_USER_ID;
  }

  return null;
}

export function getAuthProviderFlags() {
  return {
    twitch: Boolean(process.env.AUTH_TWITCH_ID && process.env.AUTH_TWITCH_SECRET),
    discord: Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET),
    email: Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM),
    demo:
      process.env.ENABLE_DEMO_AUTH === "true" ||
      process.env.NODE_ENV !== "production",
  };
}
