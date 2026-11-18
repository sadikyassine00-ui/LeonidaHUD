import fs from "fs";
import path from "path";
import { and, desc, eq, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { getDb, hasDatabaseConfig, schema } from "@/db";
import { calculateStoryProgress } from "@/data/missions";
import { generateId, generatePublicKey, generateSecretTriggerKey } from "@/lib/keys";
import type {
  HudTheme,
  OverlayStateSnapshot,
  PlanTier,
  PlanType,
  PollSnapshot,
  UserPlan,
} from "@/lib/types";

let schemaInitPromise: Promise<void> | null = null;

async function ensureUserSchemaColumns(): Promise<void> {
  if (!hasDatabaseConfig()) return;
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      try {
        const client = neon(process.env.DATABASE_URL!);
        await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'free'`;
        await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS overlay_token text`;
      } catch (err) {
        schemaInitPromise = null;
        throw err;
      }
    })();
  }
  await schemaInitPromise;
}

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER_EMAIL = "streamer@leonidahud.com";
export const DEMO_PUBLIC_KEY = "demo-leonida";
export const DEMO_SECRET_KEY = "demo-secret-key";

interface DevStoreData {
  users: Record<
    string,
    {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      plan: UserPlan;
      planType: PlanType;
      paddleCustomerId: string | null;
      paddleSubscriptionId: string | null;
      subscriptionStatus: string;
      overlayToken: string | null;
      createdAt: string;
    }
  >;
  overlays: Record<string, OverlayStateSnapshot>;
  processedWebhooks: Record<string, string>;
}

const DEV_STORE_PATH = path.join(process.cwd(), ".next", "leonida-dev-store.json");

function createInitialDevStore(): DevStoreData {
  const now = new Date().toISOString();
  const demoOverlayId = "00000000-0000-4000-8000-000000000010";
  return {
    users: {
      [DEMO_USER_ID]: {
        id: DEMO_USER_ID,
        email: DEMO_USER_EMAIL,
        name: "Leonida Broadcaster",
        image: null,
        plan: "free",
        planType: "free",
        paddleCustomerId: null,
        paddleSubscriptionId: null,
        subscriptionStatus: "inactive",
        overlayToken: DEMO_PUBLIC_KEY,
        createdAt: now,
      },
    },
    overlays: {
      [demoOverlayId]: {
        id: demoOverlayId,
        userId: DEMO_USER_ID,
        publicKey: DEMO_PUBLIC_KEY,
        secretTriggerKey: DEMO_SECRET_KEY,
        theme: "sunset-broadcast",
        plan: "free",
        twitchChannel: "",
        kickChannel: "",
        storyChapter: "Chapter 1: Welcome to Leonida",
        storyPercent: 8,
        completedMissionIds: ["ch1-m1", "ch1-m2"],
        customMissions: [],
        wastedCount: 3,
        bustedCount: 1,
        cashBalance: 14500,
        showStoryWidget: true,
        showDeathWidget: true,
        showCashWidget: true,
        showPollWidget: true,
        stateVersion: 1,
        updatedAt: now,
        activePoll: null,
      },
    },
    processedWebhooks: {},
  };
}

function readDevStore(): DevStoreData {
  try {
    if (fs.existsSync(DEV_STORE_PATH)) {
      const raw = fs.readFileSync(DEV_STORE_PATH, "utf-8");
      return JSON.parse(raw) as DevStoreData;
    }
  } catch {
    // Recreate clean store on corrupt read
  }
  const initial = createInitialDevStore();
  writeDevStore(initial);
  return initial;
}

function writeDevStore(data: DevStoreData): void {
  try {
    fs.mkdirSync(path.dirname(DEV_STORE_PATH), { recursive: true });
    fs.writeFileSync(DEV_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Ignore write failure in read-only environments
  }
}

function assertDbOrDev() {
  if (!hasDatabaseConfig() && process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL must be configured in production.");
  }
}

function toPollSnapshot(
  poll: typeof schema.polls.$inferSelect | null | undefined
): PollSnapshot | null {
  if (!poll) return null;
  return {
    id: poll.id,
    question: poll.question,
    optionA: poll.optionA,
    optionB: poll.optionB,
    votesA: poll.votesA,
    votesB: poll.votesB,
    isActive: poll.isActive,
    endsAt: poll.endsAt ? poll.endsAt.toISOString() : null,
    createdAt: poll.createdAt.toISOString(),
  };
}

function toOverlaySnapshot(
  overlay: typeof schema.overlays.$inferSelect,
  plan: UserPlan,
  poll: typeof schema.polls.$inferSelect | null
): OverlayStateSnapshot {
  const isPro = plan === "pro";
  const effectiveTheme: HudTheme = isPro
    ? ((overlay.theme as HudTheme) || "sunset-broadcast")
    : "sunset-broadcast";

  return {
    id: overlay.id,
    userId: overlay.userId,
    publicKey: overlay.publicKey,
    secretTriggerKey: overlay.secretTriggerKey,
    theme: effectiveTheme,
    plan,
    twitchChannel: overlay.twitchChannel,
    kickChannel: overlay.kickChannel,
    storyChapter: overlay.storyChapter,
    storyPercent: overlay.storyPercent,
    completedMissionIds: overlay.completedMissionIds ?? [],
    customMissions: isPro ? (overlay.customMissions ?? []) : [],
    wastedCount: overlay.wastedCount,
    bustedCount: overlay.bustedCount,
    cashBalance: Number(overlay.cashBalance ?? 0),
    showStoryWidget: overlay.showStoryWidget,
    showDeathWidget: overlay.showDeathWidget,
    showCashWidget: isPro ? overlay.showCashWidget : false,
    showPollWidget: isPro ? overlay.showPollWidget : false,
    stateVersion: overlay.stateVersion,
    updatedAt: overlay.updatedAt.toISOString(),
    activePoll: isPro ? toPollSnapshot(poll) : null,
  };
}

export async function getOverlayByPublicKey(
  publicKey: string
): Promise<OverlayStateSnapshot | null> {
  assertDbOrDev();

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    const overlay = Object.values(store.overlays).find(
      (o) => o.publicKey === publicKey
    );
    if (!overlay) return null;
    const owner = store.users[overlay.userId];
    const plan: UserPlan = owner?.plan ?? "free";
    const isPro = plan === "pro";
    return {
      ...overlay,
      plan,
      theme: isPro ? overlay.theme : "sunset-broadcast",
      customMissions: isPro ? overlay.customMissions : [],
      showCashWidget: isPro ? overlay.showCashWidget : false,
      showPollWidget: isPro ? overlay.showPollWidget : false,
      activePoll: isPro ? overlay.activePoll : null,
    };
  }

  await ensureUserSchemaColumns();
  const db = getDb();
  const rows = await db
    .select({
      overlay: schema.overlays,
      plan: schema.users.plan,
    })
    .from(schema.overlays)
    .innerJoin(schema.users, eq(schema.overlays.userId, schema.users.id))
    .where(eq(schema.overlays.publicKey, publicKey))
    .limit(1);

  if (rows.length === 0) return null;
  const { overlay, plan } = rows[0];

  const activePolls = await db
    .select()
    .from(schema.polls)
    .where(
      and(
        eq(schema.polls.overlayId, overlay.id),
        eq(schema.polls.isActive, true)
      )
    )
    .orderBy(desc(schema.polls.createdAt))
    .limit(1);

  return toOverlaySnapshot(
    overlay,
    (plan as UserPlan) || "free",
    activePolls[0] ?? null
  );
}

export async function getOverlayVersionByPublicKey(
  publicKey: string
): Promise<number | null> {
  assertDbOrDev();

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    const overlay = Object.values(store.overlays).find(
      (o) => o.publicKey === publicKey
    );
    return overlay ? overlay.stateVersion : null;
  }

  const db = getDb();
  const rows = await db
    .select({ stateVersion: schema.overlays.stateVersion })
    .from(schema.overlays)
    .where(eq(schema.overlays.publicKey, publicKey))
    .limit(1);

  return rows[0]?.stateVersion ?? null;
}

export async function getOrCreateOverlayForUser(
  userId: string
): Promise<OverlayStateSnapshot | null> {
  assertDbOrDev();

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    let user = store.users[userId];
    if (!user) {
      user = {
        id: userId,
        email: DEMO_USER_EMAIL,
        name: "Leonida Broadcaster",
        image: null,
        plan: "free",
        planType: "free",
        paddleCustomerId: null,
        paddleSubscriptionId: null,
        subscriptionStatus: "inactive",
        overlayToken: null,
        createdAt: new Date().toISOString(),
      };
      store.users[userId] = user;
    }

    let overlay = Object.values(store.overlays).find((o) => o.userId === userId);
    if (!overlay) {
      const id = generateId();
      overlay = {
        id,
        userId,
        publicKey: userId === DEMO_USER_ID ? DEMO_PUBLIC_KEY : generatePublicKey(),
        secretTriggerKey:
          userId === DEMO_USER_ID ? DEMO_SECRET_KEY : generateSecretTriggerKey(),
        theme: "sunset-broadcast",
        plan: user.plan,
        twitchChannel: "",
        kickChannel: "",
        storyChapter: "Chapter 1: Welcome to Leonida",
        storyPercent: 0,
        completedMissionIds: [],
        customMissions: [],
        wastedCount: 0,
        bustedCount: 0,
        cashBalance: 500,
        showStoryWidget: true,
        showDeathWidget: true,
        showCashWidget: true,
        showPollWidget: true,
        stateVersion: 1,
        updatedAt: new Date().toISOString(),
        activePoll: null,
      };
      store.overlays[id] = overlay;
    }
    user.overlayToken = overlay.publicKey;
    writeDevStore(store);
    const isPro = user.plan === "pro";
    return {
      ...overlay,
      plan: user.plan,
      theme: isPro ? overlay.theme : "sunset-broadcast",
      customMissions: isPro ? overlay.customMissions : [],
      showCashWidget: isPro ? overlay.showCashWidget : false,
      showPollWidget: isPro ? overlay.showPollWidget : false,
      activePoll: isPro ? overlay.activePoll : null,
    };
  }

  await ensureUserSchemaColumns();
  const db = getDb();
  const userRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (userRows.length === 0) return null;
  const user = userRows[0];

  let existing = await db
    .select()
    .from(schema.overlays)
    .where(eq(schema.overlays.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    const inserted = await db
      .insert(schema.overlays)
      .values({
        userId,
        publicKey: generatePublicKey(),
        secretTriggerKey: generateSecretTriggerKey(),
      })
      .returning();
    existing = inserted;
  }

  const overlay = existing[0];
  if (!user.overlayToken) {
    await db
      .update(schema.users)
      .set({ overlayToken: overlay.publicKey })
      .where(eq(schema.users.id, userId));
  }
  const activePolls = await db
    .select()
    .from(schema.polls)
    .where(
      and(
        eq(schema.polls.overlayId, overlay.id),
        eq(schema.polls.isActive, true)
      )
    )
    .orderBy(desc(schema.polls.createdAt))
    .limit(1);

  return toOverlaySnapshot(
    overlay,
    (user.plan as UserPlan) || "free",
    activePolls[0] ?? null
  );
}

export interface OverlayUpdatePatch {
  wastedDelta?: number;
  bustedDelta?: number;
  wastedCount?: number;
  bustedCount?: number;
  cashDelta?: number;
  cashBalance?: number;
  toggleMissionId?: string;
  completedMissionIds?: string[];
  addCustomMission?: {
    chapterNumber: number;
    chapterTitle: string;
    title: string;
    region: string;
  };
  theme?: HudTheme;
  twitchChannel?: string | null;
  kickChannel?: string | null;
  showStoryWidget?: boolean;
  showDeathWidget?: boolean;
  showCashWidget?: boolean;
  showPollWidget?: boolean;
}

export async function updateOverlayForUser(
  userId: string,
  patch: OverlayUpdatePatch
): Promise<OverlayStateSnapshot | null> {
  assertDbOrDev();
  const current = await getOrCreateOverlayForUser(userId);
  if (!current) return null;

  const nextWasted =
    typeof patch.wastedCount === "number"
      ? Math.max(0, Math.floor(patch.wastedCount))
      : Math.max(0, current.wastedCount + (patch.wastedDelta ?? 0));

  const nextBusted =
    typeof patch.bustedCount === "number"
      ? Math.max(0, Math.floor(patch.bustedCount))
      : Math.max(0, current.bustedCount + (patch.bustedDelta ?? 0));

  const nextCash =
    typeof patch.cashBalance === "number"
      ? Math.max(0, Math.round(patch.cashBalance))
      : Math.max(0, current.cashBalance + Math.round(patch.cashDelta ?? 0));

  const nextCustomMissions = [...current.customMissions];
  if (patch.addCustomMission && current.plan === "pro") {
    nextCustomMissions.push({
      id: "custom_" + generateId().slice(0, 8),
      chapterNumber: patch.addCustomMission.chapterNumber,
      chapterTitle: patch.addCustomMission.chapterTitle,
      title: patch.addCustomMission.title,
      region: patch.addCustomMission.region,
      isCustom: true,
    });
  }

  let nextCompletedIds = patch.completedMissionIds
    ? [...patch.completedMissionIds]
    : [...current.completedMissionIds];

  if (patch.toggleMissionId) {
    const exists = nextCompletedIds.includes(patch.toggleMissionId);
    if (exists) {
      nextCompletedIds = nextCompletedIds.filter(
        (id) => id !== patch.toggleMissionId
      );
    } else {
      nextCompletedIds.push(patch.toggleMissionId);
    }
  }

  const { storyPercent, storyChapter } = calculateStoryProgress(
    nextCompletedIds,
    nextCustomMissions
  );

  const nextTheme: HudTheme =
    current.plan === "pro" && patch.theme
      ? patch.theme
      : current.plan === "pro"
      ? current.theme
      : "sunset-broadcast";

  const nextTwitch =
    patch.twitchChannel !== undefined
      ? patch.twitchChannel?.trim().replace(/^@/, "") || null
      : current.twitchChannel;

  const nextKick =
    patch.kickChannel !== undefined
      ? patch.kickChannel?.trim().replace(/^@/, "") || null
      : current.kickChannel;

  const nextShowStory =
    patch.showStoryWidget !== undefined
      ? patch.showStoryWidget
      : current.showStoryWidget;
  const nextShowDeath =
    patch.showDeathWidget !== undefined
      ? patch.showDeathWidget
      : current.showDeathWidget;
  const nextShowCash =
    patch.showCashWidget !== undefined
      ? patch.showCashWidget
      : current.showCashWidget;
  const nextShowPoll =
    patch.showPollWidget !== undefined
      ? patch.showPollWidget
      : current.showPollWidget;

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    const updated: OverlayStateSnapshot = {
      ...current,
      wastedCount: nextWasted,
      bustedCount: nextBusted,
      cashBalance: nextCash,
      completedMissionIds: nextCompletedIds,
      customMissions: nextCustomMissions,
      storyPercent,
      storyChapter,
      theme: nextTheme,
      twitchChannel: nextTwitch,
      kickChannel: nextKick,
      showStoryWidget: nextShowStory,
      showDeathWidget: nextShowDeath,
      showCashWidget: nextShowCash,
      showPollWidget: nextShowPoll,
      stateVersion: current.stateVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    store.overlays[current.id] = updated;
    writeDevStore(store);
    return updated;
  }

  const db = getDb();
  const [updatedRow] = await db
    .update(schema.overlays)
    .set({
      wastedCount: nextWasted,
      bustedCount: nextBusted,
      cashBalance: nextCash,
      completedMissionIds: nextCompletedIds,
      customMissions: nextCustomMissions,
      storyPercent,
      storyChapter,
      theme: nextTheme,
      twitchChannel: nextTwitch,
      kickChannel: nextKick,
      showStoryWidget: nextShowStory,
      showDeathWidget: nextShowDeath,
      showCashWidget: nextShowCash,
      showPollWidget: nextShowPoll,
      stateVersion: sql`${schema.overlays.stateVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.overlays.id, current.id))
    .returning();

  return toOverlaySnapshot(updatedRow, current.plan, current.activePoll
    ? {
        id: current.activePoll.id,
        overlayId: current.id,
        question: current.activePoll.question,
        optionA: current.activePoll.optionA,
        optionB: current.activePoll.optionB,
        votesA: current.activePoll.votesA,
        votesB: current.activePoll.votesB,
        isActive: current.activePoll.isActive,
        endsAt: current.activePoll.endsAt ? new Date(current.activePoll.endsAt) : null,
        createdAt: new Date(current.activePoll.createdAt),
      }
    : null);
}

export type TriggerAction =
  | "wasted"
  | "busted"
  | "undo_wasted"
  | "undo_busted"
  | "cash";

export async function applyTriggerAction(
  secretTriggerKey: string,
  action: TriggerAction,
  amount?: number
): Promise<{
  ok: boolean;
  stateVersion: number;
  wastedCount: number;
  bustedCount: number;
  cashBalance: number;
} | null> {
  assertDbOrDev();

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    const overlay = Object.values(store.overlays).find(
      (o) => o.secretTriggerKey === secretTriggerKey
    );
    if (!overlay) return null;

    if (action === "wasted") overlay.wastedCount += 1;
    else if (action === "undo_wasted")
      overlay.wastedCount = Math.max(0, overlay.wastedCount - 1);
    else if (action === "busted") overlay.bustedCount += 1;
    else if (action === "undo_busted")
      overlay.bustedCount = Math.max(0, overlay.bustedCount - 1);
    else if (action === "cash") {
      const delta = Number.isFinite(amount) ? Math.round(amount ?? 0) : 0;
      overlay.cashBalance = Math.max(0, overlay.cashBalance + delta);
    }

    overlay.stateVersion += 1;
    overlay.updatedAt = new Date().toISOString();
    store.overlays[overlay.id] = overlay;
    writeDevStore(store);

    return {
      ok: true,
      stateVersion: overlay.stateVersion,
      wastedCount: overlay.wastedCount,
      bustedCount: overlay.bustedCount,
      cashBalance: overlay.cashBalance,
    };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.overlays)
    .where(eq(schema.overlays.secretTriggerKey, secretTriggerKey))
    .limit(1);

  if (rows.length === 0) return null;
  const overlay = rows[0];

  let nextWasted = overlay.wastedCount;
  let nextBusted = overlay.bustedCount;
  let nextCash = Number(overlay.cashBalance ?? 0);

  if (action === "wasted") nextWasted += 1;
  else if (action === "undo_wasted") nextWasted = Math.max(0, nextWasted - 1);
  else if (action === "busted") nextBusted += 1;
  else if (action === "undo_busted") nextBusted = Math.max(0, nextBusted - 1);
  else if (action === "cash") {
    const delta = Number.isFinite(amount) ? Math.round(amount ?? 0) : 0;
    nextCash = Math.max(0, nextCash + delta);
  }

  const [updated] = await db
    .update(schema.overlays)
    .set({
      wastedCount: nextWasted,
      bustedCount: nextBusted,
      cashBalance: nextCash,
      stateVersion: sql`${schema.overlays.stateVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.overlays.id, overlay.id))
    .returning();

  return {
    ok: true,
    stateVersion: updated.stateVersion,
    wastedCount: updated.wastedCount,
    bustedCount: updated.bustedCount,
    cashBalance: Number(updated.cashBalance ?? 0),
  };
}

export async function regenerateSecretKeyForUser(
  userId: string
): Promise<string | null> {
  assertDbOrDev();
  const overlay = await getOrCreateOverlayForUser(userId);
  if (!overlay) return null;
  const nextSecret = generateSecretTriggerKey();

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    if (store.overlays[overlay.id]) {
      store.overlays[overlay.id].secretTriggerKey = nextSecret;
      store.overlays[overlay.id].updatedAt = new Date().toISOString();
      writeDevStore(store);
    }
    return nextSecret;
  }

  const db = getDb();
  await db
    .update(schema.overlays)
    .set({
      secretTriggerKey: nextSecret,
      updatedAt: new Date(),
    })
    .where(eq(schema.overlays.id, overlay.id));

  return nextSecret;
}

export async function startPollForUser(
  userId: string,
  input: {
    question: string;
    optionA: string;
    optionB: string;
    durationSeconds?: number;
  }
): Promise<OverlayStateSnapshot | null> {
  assertDbOrDev();
  const overlay = await getOrCreateOverlayForUser(userId);
  if (!overlay) return null;

  const duration = Math.max(15, Math.min(600, input.durationSeconds ?? 60));
  const endsAt = new Date(Date.now() + duration * 1000);
  const now = new Date();

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    const target = store.overlays[overlay.id];
    const poll: PollSnapshot = {
      id: generateId(),
      question: input.question.trim().slice(0, 80) || "NEXT MOVE?",
      optionA: input.optionA.trim().slice(0, 48) || "Option A",
      optionB: input.optionB.trim().slice(0, 48) || "Option B",
      votesA: 0,
      votesB: 0,
      isActive: true,
      endsAt: endsAt.toISOString(),
      createdAt: now.toISOString(),
    };
    target.activePoll = poll;
    target.stateVersion += 1;
    target.updatedAt = now.toISOString();
    writeDevStore(store);
    return target;
  }

  const db = getDb();
  await db
    .update(schema.polls)
    .set({ isActive: false })
    .where(eq(schema.polls.overlayId, overlay.id));

  await db.insert(schema.polls).values({
    overlayId: overlay.id,
    question: input.question.trim().slice(0, 80) || "NEXT MOVE?",
    optionA: input.optionA.trim().slice(0, 48) || "Option A",
    optionB: input.optionB.trim().slice(0, 48) || "Option B",
    votesA: 0,
    votesB: 0,
    isActive: true,
    endsAt,
  });

  await db
    .update(schema.overlays)
    .set({
      stateVersion: sql`${schema.overlays.stateVersion} + 1`,
      updatedAt: now,
    })
    .where(eq(schema.overlays.id, overlay.id));

  return getOrCreateOverlayForUser(userId);
}

export async function endOrClearPollForUser(
  userId: string,
  mode: "end" | "clear"
): Promise<OverlayStateSnapshot | null> {
  assertDbOrDev();
  const overlay = await getOrCreateOverlayForUser(userId);
  if (!overlay) return null;

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    const target = store.overlays[overlay.id];
    if (mode === "clear" || !target.activePoll) {
      target.activePoll = null;
    } else {
      target.activePoll = {
        ...target.activePoll,
        isActive: false,
      };
      if (mode === "end") {
        // Keep final numbers briefly or hide immediately on clear
        target.activePoll = null;
      }
    }
    target.stateVersion += 1;
    target.updatedAt = new Date().toISOString();
    writeDevStore(store);
    return target;
  }

  const db = getDb();
  if (mode === "clear") {
    await db
      .delete(schema.polls)
      .where(
        and(
          eq(schema.polls.overlayId, overlay.id),
          eq(schema.polls.isActive, true)
        )
      );
  } else {
    await db
      .update(schema.polls)
      .set({ isActive: false })
      .where(eq(schema.polls.overlayId, overlay.id));
  }

  await db
    .update(schema.overlays)
    .set({
      stateVersion: sql`${schema.overlays.stateVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.overlays.id, overlay.id));

  return getOrCreateOverlayForUser(userId);
}

export async function syncPollVotesForUser(
  userId: string,
  input: {
    pollId: string;
    votesA: number;
    votesB: number;
  }
): Promise<OverlayStateSnapshot | null> {
  assertDbOrDev();
  const overlay = await getOrCreateOverlayForUser(userId);
  if (!overlay || !overlay.activePoll || overlay.activePoll.id !== input.pollId) {
    return overlay;
  }

  const nextVotesA = Math.max(0, Math.floor(input.votesA));
  const nextVotesB = Math.max(0, Math.floor(input.votesB));

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    const target = store.overlays[overlay.id];
    if (target.activePoll && target.activePoll.id === input.pollId) {
      if (
        target.activePoll.votesA === nextVotesA &&
        target.activePoll.votesB === nextVotesB
      ) {
        return target;
      }
      target.activePoll.votesA = nextVotesA;
      target.activePoll.votesB = nextVotesB;
      target.stateVersion += 1;
      target.updatedAt = new Date().toISOString();
      writeDevStore(store);
    }
    return target;
  }

  const db = getDb();
  if (
    overlay.activePoll.votesA === nextVotesA &&
    overlay.activePoll.votesB === nextVotesB
  ) {
    return overlay;
  }

  await db
    .update(schema.polls)
    .set({
      votesA: nextVotesA,
      votesB: nextVotesB,
    })
    .where(
      and(
        eq(schema.polls.id, input.pollId),
        eq(schema.polls.overlayId, overlay.id)
      )
    );

  await db
    .update(schema.overlays)
    .set({
      stateVersion: sql`${schema.overlays.stateVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.overlays.id, overlay.id));

  return getOrCreateOverlayForUser(userId);
}

export async function getUserBillingInfo(userId: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  plan: UserPlan;
  planTier: PlanTier;
  planType: PlanType;
  subscriptionStatus: string;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  overlayToken: string | null;
} | null> {
  assertDbOrDev();
  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    const user = store.users[userId];
    if (!user) return null;
    const plan: UserPlan = user.plan === "pro" ? "pro" : "free";
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      plan,
      planTier: plan === "pro" ? "pro" : "starter",
      planType: user.planType ?? "free",
      subscriptionStatus: user.subscriptionStatus,
      paddleCustomerId: user.paddleCustomerId,
      paddleSubscriptionId: user.paddleSubscriptionId,
      overlayToken: user.overlayToken ?? null,
    };
  }

  await ensureUserSchemaColumns();
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (rows.length === 0) return null;
  const user = rows[0];
  const plan: UserPlan = user.plan === "pro" ? "pro" : "free";
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan,
    planTier: plan === "pro" ? "pro" : "starter",
    planType: ((user.planType as PlanType) || "free"),
    subscriptionStatus: user.subscriptionStatus,
    paddleCustomerId: user.paddleCustomerId,
    paddleSubscriptionId: user.paddleSubscriptionId,
    overlayToken: user.overlayToken ?? null,
  };
}

export async function updateUserPlanFromPaddle(params: {
  eventId: string;
  eventType: string;
  userId?: string | null;
  customerEmail?: string | null;
  paddleCustomerId?: string | null;
  paddleSubscriptionId?: string | null;
  plan: UserPlan;
  planType?: PlanType;
  subscriptionStatus: string;
  isDowngrade?: boolean;
}): Promise<void> {
  assertDbOrDev();

  if (!hasDatabaseConfig()) {
    const store = readDevStore();
    if (store.processedWebhooks[params.eventId]) return;

    let targetUser = params.userId ? store.users[params.userId] : undefined;
    if (!targetUser && params.paddleCustomerId) {
      targetUser = Object.values(store.users).find(
        (u) => u.paddleCustomerId === params.paddleCustomerId
      );
    }
    if (!targetUser && params.customerEmail) {
      const normalized = params.customerEmail.trim().toLowerCase();
      targetUser = Object.values(store.users).find(
        (u) => u.email.trim().toLowerCase() === normalized
      );
    }

    if (targetUser) {
      // Never downgrade lifetime Launch Pass holders on subscription events
      if (!(params.isDowngrade && targetUser.planType === "lifetime")) {
        targetUser.plan = params.plan;
        if (params.planType) {
          targetUser.planType = params.planType;
        }
        targetUser.subscriptionStatus = params.subscriptionStatus;
        if (params.paddleCustomerId) {
          targetUser.paddleCustomerId = params.paddleCustomerId;
        }
        if (params.paddleSubscriptionId) {
          targetUser.paddleSubscriptionId = params.paddleSubscriptionId;
        }
        for (const overlay of Object.values(store.overlays)) {
          if (overlay.userId === targetUser.id) {
            overlay.plan = params.plan;
            overlay.stateVersion += 1;
            overlay.updatedAt = new Date().toISOString();
          }
        }
      }
    }
    store.processedWebhooks[params.eventId] = params.eventType;
    writeDevStore(store);
    return;
  }

  await ensureUserSchemaColumns();
  const db = getDb();
  const alreadyProcessed = await db
    .select()
    .from(schema.processedWebhooks)
    .where(eq(schema.processedWebhooks.eventId, params.eventId))
    .limit(1);

  if (alreadyProcessed.length > 0) return;

  let targetUser: typeof schema.users.$inferSelect | undefined;
  if (params.userId) {
    const found = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, params.userId))
      .limit(1);
    targetUser = found[0];
  }
  if (!targetUser && params.paddleCustomerId) {
    const found = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.paddleCustomerId, params.paddleCustomerId))
      .limit(1);
    targetUser = found[0];
  }
  if (!targetUser && params.customerEmail) {
    const normalized = params.customerEmail.trim().toLowerCase();
    const found = await db
      .select()
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${normalized}`)
      .limit(1);
    targetUser = found[0];
  }

  if (targetUser) {
    // Never downgrade lifetime Launch Pass holders
    const skipDowngrade =
      Boolean(params.isDowngrade) && targetUser.planType === "lifetime";

    if (!skipDowngrade) {
      await db
        .update(schema.users)
        .set({
          plan: params.plan,
          ...(params.planType ? { planType: params.planType } : {}),
          subscriptionStatus: params.subscriptionStatus,
          ...(params.paddleCustomerId
            ? { paddleCustomerId: params.paddleCustomerId }
            : {}),
          ...(params.paddleSubscriptionId
            ? { paddleSubscriptionId: params.paddleSubscriptionId }
            : {}),
        })
        .where(eq(schema.users.id, targetUser.id));

      await db
        .update(schema.overlays)
        .set({
          stateVersion: sql`${schema.overlays.stateVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.overlays.userId, targetUser.id));
    }
  }

  await db
    .insert(schema.processedWebhooks)
    .values({
      eventId: params.eventId,
      eventType: params.eventType,
    })
    .onConflictDoNothing();
}
