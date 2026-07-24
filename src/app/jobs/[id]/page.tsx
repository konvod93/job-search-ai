import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/job-options";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row] = await db
    .select({
      job: jobs,
      companyName: employerProfiles.companyName,
    })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(eq(jobs.id, id))
    .limit(1);

  if (!row || row.job.status !== "published") {
    notFound();
  }

  const { job, companyName } = row;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{job.title}</h1>
        <p className="text-neutral-500">{companyName}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-neutral-600">
        <span className="rounded-full bg-neutral-100 px-3 py-1">
          {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
        </span>
        {job.location && (
          <span className="rounded-full bg-neutral-100 px-3 py-1">
            {job.location}
          </span>
        )}
        {(job.salaryMin || job.salaryMax) && (
          <span className="rounded-full bg-neutral-100 px-3 py-1">
            {job.salaryMin ?? "?"}–{job.salaryMax ?? "?"}
          </span>
        )}
      </div>

      {job.skillsRequired && job.skillsRequired.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.skillsRequired.map((skill) => (
            <span
              key={skill}
              className="rounded border border-neutral-200 px-2 py-1 text-xs"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <p className="whitespace-pre-wrap text-neutral-800">
        {job.description}
      </p>

      {/* Кнопка "Відгукнутись" з'явиться, коли зробимо applications */}
    </main>
  );
}
