import NextAuth, { customFetch } from "next-auth";
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

export type AuthFailureReason = string;

let lastAuthErrorReason: string | null = null;
let lastProviderHttpDiag: string | null = null;

const ALLOWED_PROVIDERS = new Set(["twitch", "discord", "resend", "nodemailer"]);
const ALLOWED_OAUTH_ERRORS = new Set([
  "access_denied",
  "invalid_client",
  "invalid_grant",
  "redirect_uri_mismatch",
  "invalid_request",
  "invalid_scope",
  "unauthorized_client",
  "server_error",
  "temporarily_unavailable",
]);

function sanitizeReasonSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
  return cleaned || "unknown";
}

function classifyProviderErrorSnippet(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("invalid_client") ||
    lower.includes("invalid client") ||
    lower.includes("client secret")
  ) {
    return "invalid_client";
  }
  if (
    lower.includes("invalid_grant") ||
    lower.includes("invalid authorization code") ||
    lower.includes('invalid "code"') ||
    lower.includes("code expired")
  ) {
    return "invalid_grant";
  }
  if (lower.includes("redirect_uri")) {
    return "redirect_uri";
  }
  if (lower.includes("invalid_scope")) {
    return "invalid_scope";
  }
  if (lower.includes("unauthorized_client")) {
    return "unauthorized_client";
  }
  if (lower.includes("access_denied")) {
    return "access_denied";
  }
  if (lower.includes("code_verifier") || lower.includes("pkce")) {
    return "pkce";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "rate_limited";
  }
  if (lower.includes("invalid_request")) {
    return "invalid_request";
  }
  return "";
}

function mapOpeCode(rawCode: string): string {
  const normalized = rawCode.toUpperCase();
  switch (normalized) {
    case "OAUTH_JWT_CLAIM_COMPARISON_FAILED":
      return "jwt_claim";
    case "OAUTH_JWT_TIMESTAMP_CHECK_FAILED":
      return "jwt_timestamp";
    case "OAUTH_INVALID_RESPONSE":
      return "invalid_response";
    case "OAUTH_RESPONSE_IS_NOT_CONFORM":
      return "response_not_conform";
    case "OAUTH_RESPONSE_IS_NOT_JSON":
      return "response_not_json";
    case "OAUTH_PARSE_ERROR":
      return "parse_error";
    case "OAUTH_RESPONSE_BODY_ERROR":
      return "response_body_error";
    default:
      return sanitizeReasonSlug(
        rawCode.toLowerCase().replace(/^oauth_/, "")
      );
  }
}

function createProviderFetch(providerId: "twitch" | "discord"): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const stage = urlStr.includes("openid-configuration")
      ? "discovery"
      : urlStr.includes("/token")
        ? "token"
        : urlStr.includes("users/@me") || urlStr.includes("userinfo")
          ? "userinfo"
          : "http";

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    if (!headers.has("user-agent")) {
      headers.set("user-agent", "LeonidaHUD/1.0 (https://www.leonidahud.com)");
    }

    let response: Response;
    try {
      response = await fetch(input, { ...init, headers });
    } catch {
      lastProviderHttpDiag = sanitizeReasonSlug(
        `${providerId}_${stage}_network_error`
      );
      console.error("[LEONIDA OAUTH HTTP]", lastProviderHttpDiag);
      throw new Error(`Provider fetch failed during ${stage}`);
    }

    if (!response.ok) {
      const cloneText = await response
        .clone()
        .text()
        .catch(() => "");
      let snippetSource = cloneText;
      try {
        const parsed = JSON.parse(cloneText) as Record<string, unknown>;
        const jsonParts = [parsed.error, parsed.error_description, parsed.message]
          .filter((v): v is string => typeof v === "string");
        if (jsonParts.length > 0) {
          snippetSource = jsonParts.join(" ");
        }
      } catch {
        // Leave snippetSource as plain text for allowlist scan
      }

      let errSlug = classifyProviderErrorSnippet(snippetSource);
      if (response.status === 429 && !errSlug) {
        errSlug = "rate_limited";
      } else if (!errSlug && cloneText.toLowerCase().includes("cloudflare")) {
        errSlug = "blocked";
      }

      const rawDiag = errSlug
        ? `${providerId}_${stage}_${response.status}_${errSlug}`
        : `${providerId}_${stage}_${response.status}`;
      lastProviderHttpDiag = sanitizeReasonSlug(rawDiag);
      console.error(
        "[LEONIDA OAUTH HTTP]",
        lastProviderHttpDiag,
        "status=",
        response.status
      );
    }

    return response;
  };
}

function classifyAuthError(error: unknown): string {
  const parts: string[] = [];
  const visited = new Set<unknown>();
  const stack: Array<{ node: unknown; depth: number }> = [
    { node: error, depth: 0 },
  ];

  let provider: string | null = null;
  let oauthError: string | null = null;
  let opeCode: string | null = null;
  let candidateSqlState: string | null = null;

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item || item.node == null || item.depth > 10) continue;
    const { node, depth } = item;

    if (typeof node !== "object") {
      parts.push(String(node));
      continue;
    }

    if (visited.has(node)) continue;
    visited.add(node);

    if (node instanceof Error) {
      parts.push(node.name, node.message);
      const ext = node as Error & {
        type?: unknown;
        code?: unknown;
        provider?: unknown;
        providerId?: unknown;
        error?: unknown;
        cause?: unknown;
        err?: unknown;
      };
      if (typeof ext.type === "string") parts.push(ext.type);
      if (typeof ext.code === "string") {
        parts.push(ext.code);
        if (ext.code.startsWith("OAUTH_") && !opeCode) {
          opeCode = mapOpeCode(ext.code);
        } else if (/^[0-9A-Za-z]{5}$/.test(ext.code) && !candidateSqlState) {
          candidateSqlState = ext.code;
        }
      }
      if (typeof ext.error === "string") {
        parts.push(ext.error);
        const normErr = ext.error.toLowerCase();
        if (ALLOWED_OAUTH_ERRORS.has(normErr) && !oauthError) {
          oauthError = normErr;
        }
      }
      const maybeProvider =
        typeof ext.provider === "string"
          ? ext.provider
          : typeof ext.providerId === "string"
            ? ext.providerId
            : null;
      if (maybeProvider && ALLOWED_PROVIDERS.has(maybeProvider.toLowerCase()) && !provider) {
        provider = maybeProvider.toLowerCase();
      }
      if (ext.err !== undefined) stack.push({ node: ext.err, depth: depth + 1 });
      if (ext.cause !== undefined) stack.push({ node: ext.cause, depth: depth + 1 });
      continue;
    }

    const obj = node as Record<string, unknown>;
    for (const key of ["name", "message", "type", "code", "error", "error_description"]) {
      const val = obj[key];
      if (typeof val === "string") {
        parts.push(val);
      }
    }
    if (typeof obj.code === "string") {
      if (obj.code.startsWith("OAUTH_") && !opeCode) {
        opeCode = mapOpeCode(obj.code);
      } else if (/^[0-9A-Za-z]{5}$/.test(obj.code) && !candidateSqlState) {
        candidateSqlState = obj.code;
      }
    }
    if (typeof obj.error === "string") {
      const normErr = obj.error.toLowerCase();
      if (ALLOWED_OAUTH_ERRORS.has(normErr) && !oauthError) {
        oauthError = normErr;
      }
    }
    const objProvider =
      typeof obj.provider === "string"
        ? obj.provider
        : typeof obj.providerId === "string"
          ? obj.providerId
          : null;
    if (objProvider && ALLOWED_PROVIDERS.has(objProvider.toLowerCase()) && !provider) {
      provider = objProvider.toLowerCase();
    }
    if (obj.err !== undefined) stack.push({ node: obj.err, depth: depth + 1 });
    if (obj.cause !== undefined) stack.push({ node: obj.cause, depth: depth + 1 });
  }

  const combined = parts.join(" ").toLowerCase();

  if (
    combined.includes("invalidcheck") ||
    combined.includes("pkce") ||
    combined.includes("code_verifier") ||
    combined.includes("missingcsrf") ||
    combined.includes("state value could not be parsed") ||
    combined.includes("state could not be decoded") ||
    combined.includes('response parameter "state"') ||
    combined.includes('unexpected "state"')
  ) {
    return sanitizeReasonSlug(
      provider ? `${provider}_state_mismatch` : "pkce_missing"
    );
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
    return sanitizeReasonSlug(
      candidateSqlState
        ? `adapter_error_${candidateSqlState.toLowerCase()}`
        : "adapter_error"
    );
  }

  if (combined.includes("oauthprofileparseerror")) {
    return sanitizeReasonSlug(
      provider ? `${provider}_profile_parse` : "profile_parse"
    );
  }

  if (lastProviderHttpDiag) {
    return sanitizeReasonSlug(lastProviderHttpDiag);
  }

  if (oauthError) {
    return sanitizeReasonSlug(
      provider ? `${provider}_${oauthError}` : oauthError
    );
  }

  if (opeCode) {
    return sanitizeReasonSlug(provider ? `${provider}_${opeCode}` : opeCode);
  }

  if (
    combined.includes("oauthcallbackerror") ||
    combined.includes("callbackrouteerror") ||
    combined.includes("oauth")
  ) {
    return sanitizeReasonSlug(
      provider ? `${provider}_oauth_callback` : "oauth_callback"
    );
  }

  return "unknown";
}

export function consumeLastAuthErrorReason(): string | null {
  const reason = lastAuthErrorReason;
  lastAuthErrorReason = null;
  lastProviderHttpDiag = null;
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
        checks: ["state"],
        client: { token_endpoint_auth_method: "client_secret_post" },
        [customFetch]: createProviderFetch("twitch"),
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
        checks: ["state"],
        client: { token_endpoint_auth_method: "client_secret_post" },
        [customFetch]: createProviderFetch("discord"),
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
      console.error(
        "[LEONIDA AUTH ERROR]",
        reason,
        error,
        (error as Error & { cause?: unknown }).cause ?? null
      );
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
