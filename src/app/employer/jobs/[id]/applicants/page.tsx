import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { applications, candidateProfiles, employerProfiles, jobs } from "@/db/schema";
import ApplicationStatusSelect from "@/components/application-status-select";

export default async function JobApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: jobId } = await params;
  const session = await auth();

  const [row] = await db
    .select({ job: jobs, employerUserId: employerProfiles.userId })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!row || row.employerUserId !== session?.user?.id) {
    notFound();
  }

  const applicants = await db
    .select({
      id: applications.id,
      status: applications.status,
      coverLetter: applications.coverLetter,
      candidateFullName: candidateProfiles.fullName,
      candidateHeadline: candidateProfiles.headline,
    })
    .from(applications)
    .innerJoin(
      candidateProfiles,
      eq(applications.candidateId, candidateProfiles.id),
    )
    .where(eq(applications.jobId, jobId))
    .orderBy(applications.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">
        Відгуки: {row.job.title}
      </h1>

      <div className="flex flex-col gap-3">
        {applicants.length === 0 && (
          <p className="text-neutral-500">Ще немає відгуків на цю вакансію.</p>
        )}
        {applicants.map((app) => (
          <div
            key={app.id}
            className="flex flex-col gap-2 rounded border border-neutral-200 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{app.candidateFullName}</p>
                {app.candidateHeadline && (
                  <p className="text-sm text-neutral-500">
                    {app.candidateHeadline}
                  </p>
                )}
              </div>
              <ApplicationStatusSelect
                applicationId={app.id}
                initialStatus={app.status}
              />
            </div>
            {app.coverLetter && (
              <p className="whitespace-pre-wrap text-sm text-neutral-700">
                {app.coverLetter}
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
