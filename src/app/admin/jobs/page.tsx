import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { requireRole } from "@/lib/require-role";
import ModerationActions from "@/components/moderation-actions";

export default async function AdminJobsPage() {
  await requireRole("admin");

  const pendingJobs = await db
    .select({
      job: jobs,
      companyName: employerProfiles.companyName,
    })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(eq(jobs.status, "pending_review"))
    .orderBy(jobs.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Модерація вакансій</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/reports" className="underline">
            Скарги
          </Link>
          <Link href="/admin/employers" className="underline">
            Верифікація роботодавців →
          </Link>
        </div>
      </div>

      {pendingJobs.length === 0 && (
        <p className="text-neutral-500">Немає вакансій на модерації.</p>
      )}

      <div className="flex flex-col gap-3">
        {pendingJobs.map(({ job, companyName }) => (
          <div
            key={job.id}
            className="flex flex-col gap-2 rounded border border-amber-200 bg-amber-50 p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{job.title}</p>
                <p className="text-sm text-neutral-500">{companyName}</p>
              </div>
              <ModerationActions jobId={job.id} />
            </div>
            {job.moderationReason && (
              <p className="text-sm text-amber-800">
                ⚠ Причина: {job.moderationReason}
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm text-neutral-700">
              {job.description}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
