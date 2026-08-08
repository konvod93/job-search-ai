import { notFound } from "next/navigation";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { EMPLOYMENT_TYPE_LABELS, EMPLOYER_TYPE_LABELS } from "@/lib/job-options";

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [company] = await db
    .select()
    .from(employerProfiles)
    .where(eq(employerProfiles.id, id))
    .limit(1);

  if (!company) {
    notFound();
  }

  const companyJobs = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.employerId, company.id), eq(jobs.status, "published")))
    .orderBy(desc(jobs.createdAt));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{company.companyName}</h1>
          {company.verificationStatus === "verified" && (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
              ✓ Перевірена компанія
            </span>
          )}
          {company.employerType && (
            <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
              {EMPLOYER_TYPE_LABELS[company.employerType]}
            </span>
          )}
        </div>
        {company.location && (
          <p className="text-sm text-neutral-500">{company.location}</p>
        )}
        {company.website && (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-neutral-500 underline"
          >
            {company.website}
          </a>
        )}
        {company.phoneVisible && company.phone && (
          <p className="text-sm text-neutral-500">{company.phone}</p>
        )}
      </div>

      {company.companyDescription && (
        <p className="whitespace-pre-wrap text-neutral-800">
          {company.companyDescription}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          Вакансії компанії ({companyJobs.length})
        </h2>

        {companyJobs.length === 0 && (
          <p className="text-neutral-500">
            Зараз немає активних вакансій.
          </p>
        )}

        {companyJobs.map((job) => (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            className="flex items-center justify-between rounded border border-neutral-200 p-4 hover:bg-neutral-50"
          >
            <div>
              <p className="font-medium">{job.title}</p>
              <p className="text-sm text-neutral-500">
                {job.location ?? "Без локації"}
              </p>
            </div>
            <span className="text-xs text-neutral-500">
              {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
