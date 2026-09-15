CREATE TYPE "public"."service_center_tier" AS ENUM('dealer', 'network', 'private');--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "service_center_tier" "service_center_tier";