import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Twitch from "next-auth/providers/twitch";
import Discord from "next-auth/providers/discord";
import Resend from "next-auth/providers/resend";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb, hasDatabaseConfig, schema } from "@/db";
import { ensureDatabaseSchema } from "@/db/ensure-schema";
import {
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  getOrCreateOverlayForUser,
} from "@/lib/overlay-service";

export type AuthFailureReason =
  | "pkce_missing"
  | "adapter_error"
  | "oauth_callback"
  | "profile_parse"
  | "unknown";

let lastAuthErrorReason: AuthFailureReason | null = null;

function classifyAuthError(error: unknown): AuthFailureReason {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current != null; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.name, current.message);
      const maybeType = (current as Error & { type?: unknown }).type;
      if (typeof maybeType === "string") {
        parts.push(maybeType);
      }
      current = (current as Error & { cause?: unknown }).cause;
    } else if (typeof current === "object") {
      try {
        parts.push(JSON.stringify(current));
      } catch {
        parts.push(String(current));
      }
      current = (current as { cause?: unknown }).cause;
    } else {
      parts.push(String(current));
      break;
    }
  }

  const combined = parts.join(" ").toLowerCase();
  if (
    combined.includes("pkce") ||
    combined.includes("code_verifier") ||
    combined.includes("invalidcheck") ||
    combined.includes("missingcsrf") ||
    combined.includes("state value could not be parsed")
  ) {
    return "pkce_missing";
  }
  if (
    combined.includes("adaptererror") ||
    combined.includes("drizzle") ||
    combined.includes("postgres") ||
    combined.includes("neon") ||
    combined.includes("null value in column") ||
    combined.includes("violates") ||
    combined.includes("does not exist") ||
    combined.includes("connect e")
  ) {
    return "adapter_error";
  }
  if (
    combined.includes("oauthprofileparseerror") ||
    combined.includes("profile")
  ) {
    return "profile_parse";
  }
  if (
    combined.includes("oauthcallbackerror") ||
    combined.includes("callbackrouteerror") ||
    combined.includes("oauth")
  ) {
    return "oauth_callback";
  }
  return "unknown";
}

export function consumeLastAuthErrorReason(): AuthFailureReason | null {
  const reason = lastAuthErrorReason;
  lastAuthErrorReason = null;
  return reason;
}

function buildProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.AUTH_TWITCH_ID && process.env.AUTH_TWITCH_SECRET) {
    providers.push(
      Twitch({
        clientId: process.env.AUTH_TWITCH_ID,
        clientSecret: process.env.AUTH_TWITCH_SECRET,
        allowDangerousEmailAccountLinking: true,
        token: {
          async conform(response: Response) {
            const text = await response.text();
            let body: Record<string, unknown>;
            try {
              body = JSON.parse(text) as Record<string, unknown>;
            } catch {
              return new Response(text, {
                status: response.status,
                statusText: response.statusText,
                headers: {
                  "content-type":
                    response.headers.get("content-type") ?? "application/json",
                },
              });
            }

            if (response.ok) {
              if (Array.isArray(body.scope)) {
                body.scope = body.scope.join(" ");
              } else if ("scope" in body && typeof body.scope !== "string") {
                delete body.scope;
              }
            } else if (typeof body.error !== "string") {
              body = {
                error: "invalid_request",
                error_description:
                  typeof body.message === "string"
                    ? body.message
                    : "Twitch token request failed",
              };
            }

            return new Response(JSON.stringify(body), {
              status: response.status,
              statusText: response.statusText,
              headers: {
                "content-type": "application/json",
              },
            });
          },
        },
        profile(profile) {
          const twitchId = String(profile.sub ?? profile.id ?? "");
          const normalizedEmail =
            typeof profile.email === "string" && profile.email.trim().length > 0
              ? profile.email.trim().toLowerCase()
              : `twitch_${twitchId || "user"}@users.leonidahud.com`;
          return {
            id: twitchId,
            name:
              profile.preferred_username ??
              (typeof profile.name === "string" ? profile.name : null) ??
              "Twitch Broadcaster",
            email: normalizedEmail,
            image: typeof profile.picture === "string" ? profile.picture : null,
          };
        },
      })
    );
  }

  if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) {
    providers.push(
      Discord({
        clientId: process.env.AUTH_DISCORD_ID,
        clientSecret: process.env.AUTH_DISCORD_SECRET,
        allowDangerousEmailAccountLinking: true,
        profile(profile) {
          let imageUrl: string;
          if (profile.avatar === null) {
            const defaultAvatarNumber =
              profile.discriminator === "0"
                ? Number(BigInt(profile.id) >> BigInt(22)) % 6
                : parseInt(profile.discriminator, 10) % 5;
            imageUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
          } else {
            const format = profile.avatar.startsWith("a_") ? "gif" : "png";
            imageUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
          }
          const normalizedEmail =
            typeof profile.email === "string" && profile.email.trim().length > 0
              ? profile.email.trim().toLowerCase()
              : `discord_${profile.id}@users.leonidahud.com`;
          return {
            id: profile.id,
            name:
              profile.global_name ?? profile.username ?? "Discord Broadcaster",
            email: normalizedEmail,
            image: imageUrl,
          };
        },
      })
    );
  }

  // Email Magic Links require database verification_tokens storage
  if (hasDatabaseConfig()) {
    if (process.env.AUTH_RESEND_KEY) {
      providers.push(
        Resend({
          apiKey: process.env.AUTH_RESEND_KEY,
          from: process.env.EMAIL_FROM || "Leonida HUD <login@leonidahud.com>",
        })
      );
    } else if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
      providers.push(
        Nodemailer({
          server: process.env.EMAIL_SERVER,
          from: process.env.EMAIL_FROM,
        })
      );
    }
  }

  // Demo Auth ONLY activates when explicitly set to "true"
  if (process.env.ENABLE_DEMO_AUTH === "true") {
    providers.push(
      Credentials({
        id: "demo-broadcaster",
        name: "Demo Broadcaster",
        credentials: {
          email: { label: "Email", type: "email" },
        },
        async authorize(credentials) {
          const email =
            typeof credentials?.email === "string" &&
            credentials.email.includes("@")
              ? credentials.email.trim().toLowerCase()
              : DEMO_USER_EMAIL;

          if (hasDatabaseConfig()) {
            await ensureDatabaseSchema();
            const db = getDb();
            const existing = await db.query.users.findFirst({
              where: (u, { eq }) => eq(u.email, email),
            });
            if (existing) {
              return {
                id: existing.id,
                email: existing.email ?? email,
                name: existing.name ?? "Leonida Broadcaster",
                image: existing.image,
              };
            }
            const [created] = await db
              .insert(schema.users)
              .values({
                email,
                name: "Leonida Broadcaster",
                plan: "free",
              })
              .returning();
            return {
              id: created.id,
              email: created.email ?? email,
              name: created.name,
              image: created.image,
            };
          }

          return {
            id: DEMO_USER_ID,
            email: DEMO_USER_EMAIL,
            name: "Leonida Broadcaster",
            image: null,
          };
        },
      })
    );
  }

  return providers;
}

const adapter = hasDatabaseConfig()
  ? DrizzleAdapter(getDb(), {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    })
  : undefined;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "leonida-hud-dev-secret-change-in-production"
      : undefined),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  logger: {
    error(error) {
      const reason = classifyAuthError(error);
      lastAuthErrorReason = reason;
      console.error("[LEONIDA AUTH ERROR]", reason, error);
    },
  },
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      try {
        await ensureDatabaseSchema();
        await getOrCreateOverlayForUser(user.id);
      } catch (error) {
        console.error(
          "[LEONIDA AUTH EVENT ERROR] createUser overlay sync",
          error
        );
      }
    },
    async signIn({ user }) {
      if (!user.id) return;
      try {
        await ensureDatabaseSchema();
        await getOrCreateOverlayForUser(user.id);
      } catch (error) {
        console.error("[LEONIDA AUTH EVENT ERROR] signIn overlay sync", error);
      }
    },
  },
});
