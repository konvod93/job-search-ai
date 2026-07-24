CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'pending_review' BEFORE 'published';--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;