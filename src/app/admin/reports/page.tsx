import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, reports, users } from "@/db/schema";
import { requireRole } from "@/lib/require-role";
import ReportActions from "@/components/report-actions";

export default async function AdminReportsPage() {
  await requireRole("admin");

  const pendingReports = await db
    .select({
      report: reports,
      jobTitle: jobs.title,
      jobStatus: jobs.status,
      reporterEmail: users.email,
    })
    .from(reports)
    .innerJoin(jobs, eq(reports.jobId, jobs.id))
    .innerJoin(users, eq(reports.reporterId, users.id))
    .where(eq(reports.status, "pending"))
    .orderBy(reports.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Скарги на вакансії</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/jobs" className="underline">
            Модерація вакансій
          </Link>
          <Link href="/admin/employers" className="underline">
            Верифікація
          </Link>
        </div>
      </div>

      {pendingReports.length === 0 && (
        <p className="text-neutral-500">Немає скарг на розгляді.</p>
      )}

      <div className="flex flex-col gap-3">
        {pendingReports.map(({ report, jobTitle, jobStatus, reporterEmail }) => (
          <div
            key={report.id}
            className="flex flex-col gap-2 rounded border border-neutral-200 p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{jobTitle}</p>
                <p className="text-xs text-neutral-400">
                  Поточний статус вакансії: {jobStatus}
                </p>
              </div>
              <ReportActions reportId={report.id} />
            </div>
            <p className="text-sm text-neutral-700">
              <span className="font-medium">Причина:</span> {report.reason}
            </p>
            <p className="text-xs text-neutral-400">
              Від: {reporterEmail}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
