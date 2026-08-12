ALTER TABLE "reports" DROP CONSTRAINT "reports_job_id_jobs_id_fk";--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "job_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "banned_at" timestamp;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "rejected_by_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "employer_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "job_title_snapshot" varchar(255);--> statement-breakpoint
UPDATE "reports" r SET "employer_id" = j."employer_id", "job_title_snapshot" = j."title" FROM "jobs" j WHERE r."job_id" = j."id" AND r."employer_id" IS NULL;--> statement-breakpoint
DELETE FROM "reports" WHERE "employer_id" IS NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "employer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_employer_id_employer_profiles_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
