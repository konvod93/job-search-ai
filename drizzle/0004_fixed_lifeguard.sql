CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "phone_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "edrpou" varchar(20);--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "verification_status" "verification_status" DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "verification_note" text;