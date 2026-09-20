CREATE TYPE "public"."fleet_type" AS ENUM('river', 'coastal_cabotage', 'ocean_going', 'cruise_passenger');--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "foreign_employment_license_number" varchar(100);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "fleet_type" "fleet_type";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "is_foreign_vessel_crewing" boolean DEFAULT false NOT NULL;