import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { requireRole } from "@/lib/require-role";
import ModerationActions from "@/components/moderation-actions";

const CATEGORY_LABELS: Record<string, string> = {
  mlm: "МЛМ / піраміда",
  scam: "Шахрайство",
  spam: "Спам",
  exploitation_risk: "⚠ Ризик експлуатації/трафікінгу",
  other: "Інше",
};

export default async function AdminJobsPage() {
  await requireRole("admin");

  const pendingJobsRaw = await db
    .select({
      job: jobs,
      companyName: employerProfiles.companyName,
    })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(eq(jobs.status, "pending_review"))
    .orderBy(jobs.createdAt);

  // Найтерміновіше — можлива торгівля людьми/експлуатація — завжди зверху.
  const pendingJobs = [...pendingJobsRaw].sort((a, b) => {
    const aUrgent = a.job.moderationCategory === "exploitation_risk" ? 0 : 1;
    const bUrgent = b.job.moderationCategory === "exploitation_risk" ? 0 : 1;
    return aUrgent - bUrgent;
  });

  const hasExploitationRisk = pendingJobs.some(
    ({ job }) => job.moderationCategory === "exploitation_risk",
  );

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

      {hasExploitationRisk && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Серед вакансій нижче є позначені як можлива ознака трудової/сексуальної
          експлуатації. Якщо після перегляду підозра підтверджується — окрім
          відхилення вакансії, розгляньте звернення: Національна гаряча лінія
          з протидії торгівлі людьми <strong>527</strong> (безкоштовно,
          цілодобово) або поліція <strong>102</strong>.
        </div>
      )}

      {pendingJobs.length === 0 && (
        <p className="text-neutral-500">Немає вакансій на модерації.</p>
      )}

      <div className="flex flex-col gap-3">
        {pendingJobs.map(({ job, companyName }) => {
          const isExploitationRisk =
            job.moderationCategory === "exploitation_risk";
          return (
            <div
              key={job.id}
              className={`flex flex-col gap-2 rounded border p-4 ${
                isExploitationRisk
                  ? "border-red-300 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-neutral-500">{companyName}</p>
                </div>
                <ModerationActions jobId={job.id} />
              </div>
              {job.moderationCategory && (
                <span
                  className={`w-fit rounded-full px-2 py-1 text-xs ${
                    isExploitationRisk
                      ? "bg-red-200 text-red-900"
                      : "bg-amber-200 text-amber-900"
                  }`}
                >
                  {CATEGORY_LABELS[job.moderationCategory]}
                </span>
              )}
              {job.moderationReason && (
                <p
                  className={`text-sm ${
                    isExploitationRisk ? "text-red-800" : "text-amber-800"
                  }`}
                >
                  ⚠ Причина: {job.moderationReason}
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm text-neutral-700">
                {job.description}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
