import { eq, and, count } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, jobs, reports } from "@/db/schema";

const BAN_THRESHOLD = 3;

export type BanCandidate = {
  employerId: string;
  companyName: string;
  acceptedReportsCount: number;
  rejectedJobsCount: number;
};

/**
 * Знаходить employer'ів (ще не забанених), які підпадають під умови бану:
 * 3+ прийнятих (адміном) скарг АБО 3+ вакансій, які адмін вручну відхилив
 * на /admin/jobs. Це список для РУЧНОГО рішення адміна — не автобан.
 */
export async function findBanCandidates(): Promise<BanCandidate[]> {
  const acceptedReportsByEmployer = await db
    .select({
      employerId: reports.employerId,
      companyName: employerProfiles.companyName,
      acceptedReportsCount: count(reports.id),
    })
    .from(reports)
    .innerJoin(employerProfiles, eq(reports.employerId, employerProfiles.id))
    .where(and(eq(reports.status, "reviewed"), eq(employerProfiles.banned, false)))
    .groupBy(reports.employerId, employerProfiles.companyName);

  const rejectedJobsByEmployer = await db
    .select({
      employerId: jobs.employerId,
      companyName: employerProfiles.companyName,
      rejectedJobsCount: count(jobs.id),
    })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(and(eq(jobs.rejectedByAdmin, true), eq(employerProfiles.banned, false)))
    .groupBy(jobs.employerId, employerProfiles.companyName);

  const byEmployer = new Map<string, BanCandidate>();

  for (const row of acceptedReportsByEmployer) {
    byEmployer.set(row.employerId, {
      employerId: row.employerId,
      companyName: row.companyName,
      acceptedReportsCount: row.acceptedReportsCount,
      rejectedJobsCount: 0,
    });
  }

  for (const row of rejectedJobsByEmployer) {
    const existing = byEmployer.get(row.employerId);
    if (existing) {
      existing.rejectedJobsCount = row.rejectedJobsCount;
    } else {
      byEmployer.set(row.employerId, {
        employerId: row.employerId,
        companyName: row.companyName,
        acceptedReportsCount: 0,
        rejectedJobsCount: row.rejectedJobsCount,
      });
    }
  }

  return [...byEmployer.values()].filter(
    (c) =>
      c.acceptedReportsCount >= BAN_THRESHOLD ||
      c.rejectedJobsCount >= BAN_THRESHOLD,
  );
}
