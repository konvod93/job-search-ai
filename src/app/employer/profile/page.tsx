import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles } from "@/db/schema";
import { requireRole } from "@/lib/require-role";
import EmployerProfileForm from "./profile-form";

export default async function EmployerProfilePage() {
  const session = await requireRole("employer");

  const [profile] = await db
    .select()
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-neutral-500">Профіль компанії не знайдено.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Профіль компанії</h1>
        <Link
          href="/employer/dashboard"
          className="text-sm text-neutral-500 underline"
        >
          ← До кабінету
        </Link>
      </div>

      <EmployerProfileForm
        initialValues={{
          companyName: profile.companyName,
          displayName: profile.displayName ?? "",
          companyDescription: profile.companyDescription ?? "",
          website: profile.website ?? "",
          location: profile.location ?? "",
          phone: profile.phone ?? "",
          phoneVisible: profile.phoneVisible,
          employerType: profile.employerType ?? "",
          edrpou: profile.edrpou ?? "",
        }}
        verificationStatus={profile.verificationStatus}
        verificationNote={profile.verificationNote}
      />
    </main>
  );
}
