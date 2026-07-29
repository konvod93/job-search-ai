import Link from "next/link";
import { and, cosineDistance, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  candidateProfiles,
  employerProfiles,
  jobs,
} from "@/db/schema";
import { requireRole } from "@/lib/require-role";

const STATUS_LABELS: Record<string, string> = {
  applied: "Відправлено",
  viewed: "Переглянуто",
  interview: "Запрошення на співбесіду",
  rejected: "Відхилено",
  hired: "Прийнято",
};

export default async function CandidateDashboard() {
  const session = await requireRole("candidate");

  const [candidateProfile] = await db
    .select({
      id: candidateProfiles.id,
      fullName: candidateProfiles.fullName,
      embedding: candidateProfiles.embedding,
    })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session.user.id))
    .limit(1);

  const myApplications = candidateProfile
    ? await db
        .select({
          id: applications.id,
          status: applications.status,
          createdAt: applications.createdAt,
          jobId: jobs.id,
          jobTitle: jobs.title,
        })
        .from(applications)
        .innerJoin(jobs, eq(applications.jobId, jobs.id))
        .where(eq(applications.candidateId, candidateProfile.id))
        .orderBy(applications.createdAt)
    : [];

  // Рекомендовані вакансії — за косинусною схожістю embedding профілю й
  // опису вакансії (pgvector). З'являються тільки якщо в профілі вже є
  // embedding (тобто кандидат зберігав резюме/скіли хоча б раз).
  let recommendedJobs: {
    id: string;
    title: string;
    companyName: string;
    similarity: number;
  }[] = [];

  if (candidateProfile?.embedding) {
    const similarity = sql<number>`1 - (${cosineDistance(
      jobs.embedding,
      candidateProfile.embedding,
    )})`;

    recommendedJobs = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        companyName: employerProfiles.companyName,
        similarity,
      })
      .from(jobs)
      .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
      .where(and(eq(jobs.status, "published"), isNotNull(jobs.embedding)))
      .orderBy(desc(similarity))
      .limit(5);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {candidateProfile?.fullName ?? "Кабінет кандидата"}
          </h1>
          <p className="text-sm text-neutral-500">{session.user.email}</p>
        </div>
        <Link
          href="/candidate/profile"
          className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
        >
          Мій профіль / резюме
        </Link>
      </div>

      {candidateProfile?.embedding ? (
        recommendedJobs.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Рекомендовані вакансії</h2>
            <p className="text-sm text-neutral-500">
              Підібрано AI за схожістю вашого профілю з описом вакансій
            </p>
            {recommendedJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between rounded border border-neutral-200 p-4 hover:bg-neutral-50"
              >
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-neutral-500">
                    {job.companyName}
                  </p>
                </div>
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700">
                  {Math.round(job.similarity * 100)}% збіг
                </span>
              </Link>
            ))}
          </div>
        )
      ) : (
        <div className="rounded border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
          Заповніть{" "}
          <Link href="/candidate/profile" className="underline">
            профіль
          </Link>{" "}
          — тоді ми зможемо підбирати вакансії саме під вас.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Мої відгуки</h2>
        {myApplications.length === 0 && (
          <p className="text-neutral-500">
            Ще немає відгуків.{" "}
            <Link href="/jobs" className="underline">
              Переглянути вакансії
            </Link>
          </p>
        )}
        {myApplications.map((app) => (
          <Link
            key={app.id}
            href={`/jobs/${app.jobId}`}
            className="flex items-center justify-between rounded border border-neutral-200 p-4 hover:bg-neutral-50"
          >
            <p className="font-medium">{app.jobTitle}</p>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs">
              {STATUS_LABELS[app.status]}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
