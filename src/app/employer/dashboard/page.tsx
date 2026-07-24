import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";

const STATUS_LABELS: Record<string, string> = {
  draft: "Чернетка",
  pending_review: "На модерації",
  published: "Опубліковано",
  closed: "Закрито",
};

export default async function EmployerDashboard() {
  const session = await auth();

  const [employerProfile] = await db
    .select({ id: employerProfiles.id, companyName: employerProfiles.companyName })
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, session!.user.id))
    .limit(1);

  const myJobs = employerProfile
    ? await db
        .select()
        .from(jobs)
        .where(eq(jobs.employerId, employerProfile.id))
        .orderBy(jobs.createdAt)
    : [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {employerProfile?.companyName ?? "Кабінет роботодавця"}
          </h1>
          <p className="text-sm text-neutral-500">{session?.user?.email}</p>
        </div>
        <Link
          href="/employer/jobs/new"
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          + Нова вакансія
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {myJobs.length === 0 && (
          <p className="text-neutral-500">Ще немає жодної вакансії.</p>
        )}
        {myJobs.map((job) => (
          <Link
            key={job.id}
            href={`/employer/jobs/${job.id}/applicants`}
            className="flex items-center justify-between rounded border border-neutral-200 p-4 hover:bg-neutral-50"
          >
            <div>
              <p className="font-medium">{job.title}</p>
              <p className="text-sm text-neutral-500">
                {job.location ?? "Без локації"}
              </p>
            </div>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs">
              {STATUS_LABELS[job.status]}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
