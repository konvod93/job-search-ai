import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { applications, candidateProfiles, jobs } from "@/db/schema";

const applySchema = z.object({
  coverLetter: z.string().max(4000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "candidate") {
    return NextResponse.json(
      { error: "Тільки кандидати можуть відгукуватись на вакансії" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [job] = await db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job || job.status !== "published") {
    return NextResponse.json(
      { error: "Вакансію не знайдено" },
      { status: 404 },
    );
  }

  const [candidateProfile] = await db
    .select({ id: candidateProfiles.id })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session.user.id))
    .limit(1);

  if (!candidateProfile) {
    return NextResponse.json(
      { error: "Профіль кандидата не знайдено" },
      { status: 404 },
    );
  }

  const [existing] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.jobId, jobId),
        eq(applications.candidateId, candidateProfile.id),
      ),
    )
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Ви вже відгукнулись на цю вакансію" },
      { status: 409 },
    );
  }

  const [application] = await db
    .insert(applications)
    .values({
      jobId,
      candidateId: candidateProfile.id,
      coverLetter: parsed.data.coverLetter,
    })
    .returning();

  return NextResponse.json(application, { status: 201 });
}
