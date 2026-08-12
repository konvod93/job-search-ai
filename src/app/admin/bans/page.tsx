import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles } from "@/db/schema";
import { requireRole } from "@/lib/require-role";
import { findBanCandidates } from "@/lib/ban-candidates";
import { BanButton, UnbanButton } from "@/components/ban-buttons";

export default async function AdminBansPage() {
  await requireRole("admin");

  const candidates = await findBanCandidates();
  const bannedEmployers = await db
    .select()
    .from(employerProfiles)
    .where(eq(employerProfiles.banned, true));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Кандидати на бан</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/reports" className="underline">
            Скарги
          </Link>
          <Link href="/admin/jobs" className="underline">
            Модерація вакансій
          </Link>
        </div>
      </div>

      <p className="text-sm text-neutral-500">
        Умови потрапляння в список: 3+ прийнятих скарг АБО 3+ вакансій,
        відхилених вами на модерації. Це список для ручного рішення — бан не
        відбувається автоматично.
      </p>

      {candidates.length === 0 && (
        <p className="text-neutral-500">Наразі немає кандидатів на бан.</p>
      )}

      <div className="flex flex-col gap-3">
        {candidates.map((c) => (
          <div
            key={c.employerId}
            className="flex items-center justify-between rounded border border-red-200 bg-red-50 p-4"
          >
            <div>
              <p className="font-medium">{c.companyName}</p>
              <p className="text-sm text-red-800">
                {c.acceptedReportsCount} прийнятих скарг ·{" "}
                {c.rejectedJobsCount} відхилених вакансій
              </p>
            </div>
            <BanButton
              employerId={c.employerId}
              suggestedReason={`${c.acceptedReportsCount} прийнятих скарг, ${c.rejectedJobsCount} відхилених вакансій`}
            />
          </div>
        ))}
      </div>

      {bannedEmployers.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Забанені роботодавці</h2>
          {bannedEmployers.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded border border-neutral-300 bg-neutral-50 p-4"
            >
              <div>
                <p className="font-medium">{e.companyName}</p>
                {e.banReason && (
                  <p className="text-sm text-neutral-500">{e.banReason}</p>
                )}
              </div>
              <UnbanButton employerId={e.id} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
