CREATE TYPE "public"."employer_type" AS ENUM('commercial', 'noncommercial', 'military_security', 'fop');--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "employer_type" "employer_type";--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "is_free_tier" boolean DEFAULT false NOT NULL;