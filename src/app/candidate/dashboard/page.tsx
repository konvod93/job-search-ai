import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { applications, candidateProfiles, jobs } from "@/db/schema";

const STATUS_LABELS: Record<string, string> = {
  applied: "Відправлено",
  viewed: "Переглянуто",
  interview: "Запрошення на співбесіду",
  rejected: "Відхилено",
  hired: "Прийнято",
};

export default async function CandidateDashboard() {
  const session = await auth();

  const [candidateProfile] = await db
    .select({ id: candidateProfiles.id, fullName: candidateProfiles.fullName })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session!.user.id))
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {candidateProfile?.fullName ?? "Кабінет кандидата"}
        </h1>
        <p className="text-sm text-neutral-500">{session?.user?.email}</p>
      </div>

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
