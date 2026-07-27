import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { candidateProfiles } from "@/db/schema";

const updateProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
  experienceYears: z.number().int().nonnegative().optional(),
  skills: z.array(z.string()).optional(),
  resumeText: z.string().optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "candidate") {
    return NextResponse.json(
      { error: "Доступно лише кандидатам" },
      { status: 403 },
    );
  }

  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Профіль не знайдено" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "candidate") {
    return NextResponse.json(
      { error: "Доступно лише кандидатам" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(candidateProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(candidateProfiles.userId, session.user.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Профіль не знайдено" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
