import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";

const updateJobSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  location: z.string().optional(),
  employmentType: z
    .enum(["full_time", "part_time", "contract", "internship", "remote"])
    .optional(),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  skillsRequired: z.array(z.string()).optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
});

async function getJobWithOwner(jobId: string) {
  const [row] = await db
    .select({
      job: jobs,
      employerUserId: employerProfiles.userId,
    })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(eq(jobs.id, jobId))
    .limit(1);

  return row;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await getJobWithOwner(id);

  if (!row) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  return NextResponse.json(row.job);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const row = await getJobWithOwner(id);
  if (!row) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  if (row.employerUserId !== session.user.id) {
    return NextResponse.json(
      { error: "Немає прав на редагування цієї вакансії" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = updateJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(jobs)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const row = await getJobWithOwner(id);
  if (!row) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  if (row.employerUserId !== session.user.id) {
    return NextResponse.json(
      { error: "Немає прав на видалення цієї вакансії" },
      { status: 403 },
    );
  }

  await db.delete(jobs).where(eq(jobs.id, id));

  return NextResponse.json({ success: true });
}
