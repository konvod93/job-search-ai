import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS } from "@/lib/job-options";

type SearchParams = Promise<{
  q?: string;
  location?: string;
  employmentType?: string;
}>;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, location, employmentType } = await searchParams;

  const filters = [eq(jobs.status, "published")];

  if (q) {
    filters.push(
      or(ilike(jobs.title, `%${q}%`), ilike(jobs.description, `%${q}%`))!,
    );
  }
  if (location) {
    filters.push(ilike(jobs.location, `%${location}%`));
  }
  if (
    employmentType &&
    EMPLOYMENT_TYPES.some((t) => t.value === employmentType)
  ) {
    filters.push(
      eq(jobs.employmentType, employmentType as (typeof EMPLOYMENT_TYPES)[number]["value"]),
    );
  }

  const results = await db
    .select()
    .from(jobs)
    .where(and(...filters))
    .orderBy(desc(jobs.createdAt))
    .limit(50);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Вакансії</h1>

      <form className="flex flex-wrap gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Посада або ключове слово"
          className="flex-1 rounded border border-neutral-300 px-3 py-2"
        />
        <input
          type="text"
          name="location"
          defaultValue={location}
          placeholder="Локація"
          className="w-40 rounded border border-neutral-300 px-3 py-2"
        />
        <select
          name="employmentType"
          defaultValue={employmentType ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        >
          <option value="">Будь-який тип</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-white"
        >
          Знайти
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {results.length === 0 && (
          <p className="text-neutral-500">
            Нічого не знайдено за вашим запитом.
          </p>
        )}
        {results.map((job) => (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            className="flex flex-col gap-1 rounded border border-neutral-200 p-4 hover:bg-neutral-50"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">{job.title}</p>
              <span className="text-xs text-neutral-500">
                {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
              </span>
            </div>
            <p className="text-sm text-neutral-500">
              {job.location ?? "Без локації"}
              {job.salaryMin || job.salaryMax
                ? ` · ${job.salaryMin ?? "?"}–${job.salaryMax ?? "?"}`
                : ""}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
