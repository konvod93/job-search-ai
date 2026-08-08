import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, users } from "@/db/schema";
import { requireRole } from "@/lib/require-role";
import { isGenericEmailDomain } from "@/lib/email-domain";
import { EMPLOYER_TYPE_LABELS } from "@/lib/job-options";
import EmployerVerificationActions from "@/components/employer-verification-actions";

export default async function AdminEmployersPage() {
  await requireRole("admin");

  const pending = await db
    .select({
      employer: employerProfiles,
      email: users.email,
    })
    .from(employerProfiles)
    .innerJoin(users, eq(employerProfiles.userId, users.id))
    .where(eq(employerProfiles.verificationStatus, "pending"))
    .orderBy(employerProfiles.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Верифікація роботодавців</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/reports" className="underline">
            Скарги
          </Link>
          <Link href="/admin/jobs" className="underline">
            Модерація вакансій →
          </Link>
        </div>
      </div>

      {pending.length === 0 && (
        <p className="text-neutral-500">Немає заявок на верифікацію.</p>
      )}

      <div className="flex flex-col gap-3">
        {pending.map(({ employer, email }) => {
          const generic = isGenericEmailDomain(email);
          return (
            <div
              key={employer.id}
              className="flex flex-col gap-2 rounded border border-neutral-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{employer.companyName}</p>
                  <p className="text-sm text-neutral-500">{email}</p>
                </div>
                <EmployerVerificationActions employerId={employer.id} />
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-neutral-900 px-2 py-1 text-white">
                  {employer.employerType
                    ? EMPLOYER_TYPE_LABELS[employer.employerType]
                    : "Тип не вказано"}
                </span>
                {employer.isFreeTier && (
                  <span className="rounded-full bg-green-50 px-2 py-1 text-green-700">
                    Безкоштовний тариф
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-1 ${
                    generic
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {generic
                    ? "Пошта на безкоштовному сервісі"
                    : "Корпоративний домен пошти"}
                </span>
                {employer.website && (
                  <span className="rounded-full bg-neutral-100 px-2 py-1">
                    Сайт: {employer.website}
                  </span>
                )}
              </div>

              <p className="text-sm">
                {employer.employerType === "fop" ? "ІПН/РНОКПП" : "ЄДРПОУ"}:{" "}
                <a
                  href={`https://www.google.com/search?q=%D0%84%D0%94%D0%A0%D0%9F%D0%9E%D0%A3+${employer.edrpou}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                >
                  {employer.edrpou} (перевірити) ↗
                </a>
              </p>

              {employer.companyDescription && (
                <p className="text-sm text-neutral-600">
                  {employer.companyDescription}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
