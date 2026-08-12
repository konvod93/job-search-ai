import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, jobs, reports, users } from "@/db/schema";
import { requireRole } from "@/lib/require-role";
import ReportActions from "@/components/report-actions";

export default async function AdminReportsPage() {
  await requireRole("admin");

  // LEFT JOIN на jobs — job може бути видалений (jobId стає null через
  // ON DELETE SET NULL) або скарга взагалі загальна на роботодавця
  // (jobId=null із самого початку). jobTitleSnapshot покриває обидва
  // випадки для відображення.
  const pendingReports = await db
    .select({
      report: reports,
      companyName: employerProfiles.companyName,
      jobStatus: jobs.status,
      reporterEmail: users.email,
    })
    .from(reports)
    .innerJoin(employerProfiles, eq(reports.employerId, employerProfiles.id))
    .leftJoin(jobs, eq(reports.jobId, jobs.id))
    .innerJoin(users, eq(reports.reporterId, users.id))
    .where(eq(reports.status, "pending"))
    .orderBy(reports.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Скарги</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/jobs" className="underline">
            Модерація вакансій
          </Link>
          <Link href="/admin/employers" className="underline">
            Верифікація
          </Link>
          <Link href="/admin/bans" className="underline">
            Кандидати на бан →
          </Link>
        </div>
      </div>

      {pendingReports.length === 0 && (
        <p className="text-neutral-500">Немає скарг на розгляді.</p>
      )}

      <div className="flex flex-col gap-3">
        {pendingReports.map(({ report, companyName, jobStatus, reporterEmail }) => (
          <div
            key={report.id}
            className="flex flex-col gap-2 rounded border border-neutral-200 p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">
                  {report.jobTitleSnapshot ?? (
                    <span className="text-neutral-500">
                      Загальна скарга на роботодавця
                    </span>
                  )}
                </p>
                <p className="text-sm text-neutral-500">{companyName}</p>
                {report.jobId && (
                  <p className="text-xs text-neutral-400">
                    Поточний статус вакансії: {jobStatus ?? "видалена"}
                  </p>
                )}
              </div>
              <ReportActions reportId={report.id} />
            </div>
            <p className="text-sm text-neutral-700">
              <span className="font-medium">Причина:</span> {report.reason}
            </p>
            <p className="text-xs text-neutral-400">Від: {reporterEmail}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
