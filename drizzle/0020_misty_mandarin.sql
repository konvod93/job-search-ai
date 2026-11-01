ALTER TABLE "employer_profiles" ADD COLUMN "intermediary_list_date" varchar(10);--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "intermediary_countries" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "employer_profiles" ADD COLUMN "mlc_certificate" varchar(100);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "work_abroad_country" varchar(2);