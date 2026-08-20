import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { requireRole } from "@/lib/require-role";
import JobForm, { type JobFormValues } from "@/components/job-form";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole("employer");

  const [row] = await db
    .select({
      job: jobs,
      employerUserId: employerProfiles.userId,
    })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(eq(jobs.id, id))
    .limit(1);

  if (!row || row.employerUserId !== session.user.id) {
    notFound();
  }

  const { job } = row;

  return (
    <JobForm
      jobId={job.id}
      initialValues={{
        title: job.title,
        description: job.description,
        location: job.location ?? "",
        category: job.category,
        subcategory: job.subcategory ?? "",
        crossListedCategories: (job.crossListedCategories ??
          []) as JobFormValues["crossListedCategories"],
        employmentType: job.employmentType,
        salaryMin: job.salaryMin?.toString() ?? "",
        salaryMax: job.salaryMax?.toString() ?? "",
        skillsInput: (job.skillsRequired ?? []).join(", "),
        status:
          job.status === "pending_review" ? "draft" : job.status,
      }}
    />
  );
}
