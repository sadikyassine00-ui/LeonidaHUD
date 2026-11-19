import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { MissionItem } from "@/lib/types";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  name: text("name"),
  image: text("image"),
  plan: text("plan").default("free").notNull(), // 'free' (starter) | 'pro'
  planType: text("plan_type").default("free").notNull(), // 'free' | 'lifetime' | 'monthly'
  paddleCustomerId: text("paddle_customer_id"),
  paddleSubscriptionId: text("paddle_subscription_id"),
  subscriptionStatus: text("subscription_status").default("inactive").notNull(),
  overlayToken: text("overlay_token"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
);

export const overlays = pgTable("overlays", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  publicKey: text("public_key").unique().notNull(),
  secretTriggerKey: text("secret_trigger_key").unique().notNull(),
  theme: text("theme").default("sunset-broadcast").notNull(), // 'sunset-broadcast' | 'minimal-glass' | 'tactical-dark'
  twitchChannel: text("twitch_channel"),
  kickChannel: text("kick_channel"),
  storyChapter: text("story_chapter")
    .default("Story Playthrough")
    .notNull(),
  storyPercent: integer("story_percent").default(0).notNull(),
  completedMissionIds: jsonb("completed_mission_ids")
    .$type<string[]>()
    .default([])
    .notNull(),
  customMissions: jsonb("custom_missions")
    .$type<MissionItem[]>()
    .default([])
    .notNull(),
  wastedCount: integer("wasted_count").default(0).notNull(),
  bustedCount: integer("busted_count").default(0).notNull(),
  cashBalance: bigint("cash_balance", { mode: "number" })
    .default(500)
    .notNull(),
  showStoryWidget: boolean("show_story_widget").default(true).notNull(),
  showDeathWidget: boolean("show_death_widget").default(true).notNull(),
  showCashWidget: boolean("show_cash_widget").default(true).notNull(),
  showPollWidget: boolean("show_poll_widget").default(true).notNull(),
  clipSafeMode: boolean("clip_safe_mode").default(false).notNull(),
  hookBanner: text("hook_banner"),
  stateVersion: integer("state_version").default(1).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const polls = pgTable("polls", {
  id: uuid("id").defaultRandom().primaryKey(),
  overlayId: uuid("overlay_id")
    .notNull()
    .references(() => overlays.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  votesA: integer("votes_a").default(0).notNull(),
  votesB: integer("votes_b").default(0).notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  endsAt: timestamp("ends_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const processedWebhooks = pgTable("processed_webhooks", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { mode: "date" })
    .defaultNow()
    .notNull(),
});
