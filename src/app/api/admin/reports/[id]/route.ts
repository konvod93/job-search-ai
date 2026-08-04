import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { jobs, reports } from "@/db/schema";

const actionSchema = z.object({
  action: z.enum(["accept", "dismiss"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Доступ лише для адміністраторів" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: "Скаргу не знайдено" }, { status: 404 });
  }

  await db
    .update(reports)
    .set({ status: parsed.data.action === "accept" ? "reviewed" : "dismissed" })
    .where(eq(reports.id, id));

  // Скарга прийнята — знімаємо вакансію з публікації (employer зможе
  // відредагувати й повторно подати на публікацію/модерацію).
  if (parsed.data.action === "accept") {
    await db
      .update(jobs)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(jobs.id, report.jobId));
  }

  return NextResponse.json({ success: true });
}
