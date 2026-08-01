import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { requireRole } from "@/lib/require-role";

const STATUS_LABELS: Record<string, string> = {
  draft: "Чернетка",
  pending_review: "На модерації",
  published: "Опубліковано",
  closed: "Закрито",
};

export default async function EmployerDashboard() {
  const session = await requireRole("employer");

  const [employerProfile] = await db
    .select({ id: employerProfiles.id, companyName: employerProfiles.companyName })
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, session.user.id))
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
          <p className="text-sm text-neutral-500">{session.user.email}</p>
          {employerProfile && (
            <p className="text-sm">
              <Link
                href={`/companies/${employerProfile.id}`}
                className="text-neutral-500 underline"
              >
                Публічний профіль
              </Link>
              {" · "}
              <Link
                href="/employer/profile"
                className="text-neutral-500 underline"
              >
                Редагувати профіль
              </Link>
            </p>
          )}
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
          <div
            key={job.id}
            className="flex items-center justify-between rounded border border-neutral-200 p-4"
          >
            <Link
              href={`/employer/jobs/${job.id}/applicants`}
              className="flex-1 hover:underline"
            >
              <p className="font-medium">{job.title}</p>
              <p className="text-sm text-neutral-500">
                {job.location ?? "Без локації"}
              </p>
              {job.status === "pending_review" && job.moderationReason && (
                <p className="mt-1 text-xs text-amber-700">
                  ⚠ {job.moderationReason}
                </p>
              )}
            </Link>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  job.status === "pending_review"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-neutral-100"
                }`}
              >
                {STATUS_LABELS[job.status]}
              </span>
              <Link
                href={`/employer/jobs/${job.id}/edit`}
                className="text-sm text-neutral-500 underline"
              >
                Редагувати
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
