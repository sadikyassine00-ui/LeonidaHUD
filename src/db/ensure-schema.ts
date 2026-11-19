import { neon } from "@neondatabase/serverless";
import { hasDatabaseConfig } from "./index";

let schemaPromise: Promise<void> | null = null;

/**
 * Ensures all NextAuth and Leonida HUD tables and upgrade columns exist in
 * Neon Postgres once per server cold start.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!hasDatabaseConfig()) return;

  if (!schemaPromise) {
    schemaPromise = (async () => {
      try {
        const client = neon(process.env.DATABASE_URL!);

        await client`
          CREATE TABLE IF NOT EXISTS users (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            email text UNIQUE NOT NULL,
            email_verified timestamp,
            name text,
            image text,
            plan text NOT NULL DEFAULT 'free',
            plan_type text NOT NULL DEFAULT 'free',
            paddle_customer_id text,
            paddle_subscription_id text,
            subscription_status text NOT NULL DEFAULT 'inactive',
            overlay_token text,
            created_at timestamp NOT NULL DEFAULT now()
          )
        `;

        await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'free'`;
        await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS overlay_token text`;

        await client`
          CREATE TABLE IF NOT EXISTS accounts (
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type text NOT NULL,
            provider text NOT NULL,
            provider_account_id text NOT NULL,
            refresh_token text,
            access_token text,
            expires_at integer,
            token_type text,
            scope text,
            id_token text,
            session_state text,
            PRIMARY KEY (provider, provider_account_id)
          )
        `;

        await client`
          CREATE TABLE IF NOT EXISTS sessions (
            session_token text PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires timestamp NOT NULL
          )
        `;

        await client`
          CREATE TABLE IF NOT EXISTS verification_tokens (
            identifier text NOT NULL,
            token text NOT NULL,
            expires timestamp NOT NULL,
            PRIMARY KEY (identifier, token)
          )
        `;

        await client`
          CREATE TABLE IF NOT EXISTS overlays (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            public_key text UNIQUE NOT NULL,
            secret_trigger_key text UNIQUE NOT NULL,
            theme text NOT NULL DEFAULT 'sunset-broadcast',
            twitch_channel text,
            kick_channel text,
            story_chapter text NOT NULL DEFAULT 'Chapter 1: Welcome to Leonida',
            story_percent integer NOT NULL DEFAULT 0,
            completed_mission_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
            custom_missions jsonb NOT NULL DEFAULT '[]'::jsonb,
            wasted_count integer NOT NULL DEFAULT 0,
            busted_count integer NOT NULL DEFAULT 0,
            cash_balance bigint NOT NULL DEFAULT 500,
            show_story_widget boolean NOT NULL DEFAULT true,
            show_death_widget boolean NOT NULL DEFAULT true,
            show_cash_widget boolean NOT NULL DEFAULT true,
            show_poll_widget boolean NOT NULL DEFAULT true,
            clip_safe_mode boolean NOT NULL DEFAULT false,
            hook_banner text,
            state_version integer NOT NULL DEFAULT 1,
            updated_at timestamp NOT NULL DEFAULT now()
          )
        `;

        await client`ALTER TABLE overlays ADD COLUMN IF NOT EXISTS clip_safe_mode boolean NOT NULL DEFAULT false`;
        await client`ALTER TABLE overlays ADD COLUMN IF NOT EXISTS hook_banner text`;

        await client`
          CREATE TABLE IF NOT EXISTS polls (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            overlay_id uuid NOT NULL REFERENCES overlays(id) ON DELETE CASCADE,
            question text NOT NULL,
            option_a text NOT NULL,
            option_b text NOT NULL,
            votes_a integer NOT NULL DEFAULT 0,
            votes_b integer NOT NULL DEFAULT 0,
            is_active boolean NOT NULL DEFAULT false,
            ends_at timestamp,
            created_at timestamp NOT NULL DEFAULT now()
          )
        `;

        await client`
          CREATE TABLE IF NOT EXISTS processed_webhooks (
            event_id text PRIMARY KEY,
            event_type text NOT NULL,
            processed_at timestamp NOT NULL DEFAULT now()
          )
        `;
      } catch (err) {
        schemaPromise = null;
        throw err;
      }
    })();
  }

  await schemaPromise;
}
