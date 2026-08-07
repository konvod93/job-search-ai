import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateProfiles } from "@/db/schema";
import { requireRole } from "@/lib/require-role";
import ProfileForm from "./profile-form";

export default async function CandidateProfilePage() {
  const session = await requireRole("candidate");

  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session.user.id))
    .limit(1);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Мій профіль</h1>
      <ProfileForm
        initial={{
          fullName: profile?.fullName ?? "",
          headline: profile?.headline ?? "",
          location: profile?.location ?? "",
          preferredCategory: profile?.preferredCategory ?? null,
          experienceYears: profile?.experienceYears ?? null,
          skills: profile?.skills ?? [],
          resumeText: profile?.resumeText ?? "",
        }}
      />
    </main>
  );
}
