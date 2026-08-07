CREATE TYPE "public"."job_category" AS ENUM('it', 'construction', 'manufacturing', 'trade', 'drivers', 'agriculture', 'government', 'accounting', 'education', 'military', 'other');--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "preferred_category" "job_category";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "category" "job_category" DEFAULT 'other' NOT NULL;