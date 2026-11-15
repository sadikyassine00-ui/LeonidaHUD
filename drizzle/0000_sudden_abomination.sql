CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "overlays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"secret_trigger_key" text NOT NULL,
	"theme" text DEFAULT 'sunset-broadcast' NOT NULL,
	"twitch_channel" text,
	"kick_channel" text,
	"story_chapter" text DEFAULT 'Chapter 1: Welcome to Leonida' NOT NULL,
	"story_percent" integer DEFAULT 0 NOT NULL,
	"completed_mission_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_missions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"wasted_count" integer DEFAULT 0 NOT NULL,
	"busted_count" integer DEFAULT 0 NOT NULL,
	"cash_balance" bigint DEFAULT 500 NOT NULL,
	"show_story_widget" boolean DEFAULT true NOT NULL,
	"show_death_widget" boolean DEFAULT true NOT NULL,
	"show_cash_widget" boolean DEFAULT true NOT NULL,
	"show_poll_widget" boolean DEFAULT true NOT NULL,
	"state_version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "overlays_public_key_unique" UNIQUE("public_key"),
	CONSTRAINT "overlays_secret_trigger_key_unique" UNIQUE("secret_trigger_key")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"overlay_id" uuid NOT NULL,
	"question" text NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"votes_a" integer DEFAULT 0 NOT NULL,
	"votes_b" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_webhooks" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"name" text,
	"image" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"paddle_customer_id" text,
	"paddle_subscription_id" text,
	"subscription_status" text DEFAULT 'inactive' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overlays" ADD CONSTRAINT "overlays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_overlay_id_overlays_id_fk" FOREIGN KEY ("overlay_id") REFERENCES "public"."overlays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;