import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { applications, employerProfiles, jobs } from "@/db/schema";

const updateStatusSchema = z.object({
  status: z.enum(["applied", "viewed", "interview", "rejected", "hired"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: applicationId } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [row] = await db
    .select({
      applicationId: applications.id,
      employerUserId: employerProfiles.userId,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(eq(applications.id, applicationId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
  }

  if (row.employerUserId !== session.user.id) {
    return NextResponse.json(
      { error: "Немає прав на редагування цієї заявки" },
      { status: 403 },
    );
  }

  const [updated] = await db
    .update(applications)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(applications.id, applicationId))
    .returning();

  return NextResponse.json(updated);
}
