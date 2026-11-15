import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Twitch from "next-auth/providers/twitch";
import Discord from "next-auth/providers/discord";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb, hasDatabaseConfig, schema } from "@/db";
import {
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  getOrCreateOverlayForUser,
} from "@/lib/overlay-service";

function buildProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.AUTH_TWITCH_ID && process.env.AUTH_TWITCH_SECRET) {
    providers.push(
      Twitch({
        clientId: process.env.AUTH_TWITCH_ID,
        clientSecret: process.env.AUTH_TWITCH_SECRET,
      })
    );
  }

  if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) {
    providers.push(
      Discord({
        clientId: process.env.AUTH_DISCORD_ID,
        clientSecret: process.env.AUTH_DISCORD_SECRET,
      })
    );
  }

  if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
    providers.push(
      Nodemailer({
        server: process.env.EMAIL_SERVER,
        from: process.env.EMAIL_FROM,
      })
    );
  }

  const demoAllowed =
    process.env.ENABLE_DEMO_AUTH === "true" ||
    process.env.NODE_ENV !== "production";

  if (demoAllowed) {
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
            const db = getDb();
            const existing = await db.query.users.findFirst({
              where: (u, { eq }) => eq(u.email, email),
            });
            if (existing) {
              return {
                id: existing.id,
                email: existing.email,
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
              email: created.email,
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
      if (user.id) {
        await getOrCreateOverlayForUser(user.id);
      }
    },
  },
});
