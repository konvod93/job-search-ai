import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles, jobs, reports } from "@/db/schema";

// Скарга на вакансію (jobId) АБО на роботодавця загалом (employerId) —
// принаймні одне з двох обов'язкове.
const createReportSchema = z
  .object({
    jobId: z.uuid().optional(),
    employerId: z.uuid().optional(),
    reason: z.string().min(1, "Опишіть причину скарги"),
  })
  .refine((data) => data.jobId || data.employerId, {
    message: "Вкажіть jobId або employerId",
    path: ["jobId"],
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

  let employerId = parsed.data.employerId;
  let jobTitleSnapshot: string | null = null;

  if (parsed.data.jobId) {
    const [job] = await db
      .select({ id: jobs.id, employerId: jobs.employerId, title: jobs.title })
      .from(jobs)
      .where(eq(jobs.id, parsed.data.jobId))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
    }

    employerId = job.employerId;
    jobTitleSnapshot = job.title;

    const [existingJobReport] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(eq(reports.jobId, job.id), eq(reports.reporterId, session.user.id)),
      )
      .limit(1);

    if (existingJobReport) {
      return NextResponse.json(
        { error: "Ви вже надсилали скаргу на цю вакансію" },
        { status: 409 },
      );
    }
  } else if (employerId) {
    // Загальна скарга на роботодавця (не прив'язана до конкретної
    // вакансії) — дедуп перевіряємо на рівні коду, бо DB-констрейнт цього
    // не покриває для jobId=null.
    const [employer] = await db
      .select({ id: employerProfiles.id })
      .from(employerProfiles)
      .where(eq(employerProfiles.id, employerId))
      .limit(1);

    if (!employer) {
      return NextResponse.json(
        { error: "Роботодавця не знайдено" },
        { status: 404 },
      );
    }

    const [existingGeneralReport] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.employerId, employerId),
          eq(reports.reporterId, session.user.id),
          isNull(reports.jobId),
        ),
      )
      .limit(1);

    if (existingGeneralReport) {
      return NextResponse.json(
        { error: "Ви вже надсилали загальну скаргу на цього роботодавця" },
        { status: 409 },
      );
    }
  }

  const [report] = await db
    .insert(reports)
    .values({
      employerId: employerId!,
      jobId: parsed.data.jobId ?? null,
      jobTitleSnapshot,
      reporterId: session.user.id,
      reason: parsed.data.reason,
    })
    .returning();

  return NextResponse.json(report, { status: 201 });
}
