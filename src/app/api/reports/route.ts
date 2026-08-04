import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { jobs, reports } from "@/db/schema";

const createReportSchema = z.object({
  jobId: z.uuid(),
  reason: z.string().min(1, "Опишіть причину скарги"),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createReportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.id, parsed.data.jobId))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  const [existing] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.jobId, job.id),
        eq(reports.reporterId, session.user.id),
      ),
    )
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Ви вже надсилали скаргу на цю вакансію" },
      { status: 409 },
    );
  }

  const [report] = await db
    .insert(reports)
    .values({
      jobId: job.id,
      reporterId: session.user.id,
      reason: parsed.data.reason,
    })
    .returning();

  return NextResponse.json(report, { status: 201 });
}
