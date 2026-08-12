import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray, and } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";

const actionSchema = z.object({
  action: z.enum(["ban", "unban"]),
  reason: z.string().optional(),
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

  const isBanning = parsed.data.action === "ban";

  const [updated] = await db
    .update(employerProfiles)
    .set({
      banned: isBanning,
      bannedAt: isBanning ? new Date() : null,
      banReason: isBanning ? (parsed.data.reason ?? null) : null,
      updatedAt: new Date(),
    })
    .where(eq(employerProfiles.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Роботодавця не знайдено" },
      { status: 404 },
    );
  }

  // При бані одразу знімаємо всі активні вакансії з публікації — не чекаємо,
  // поки employer сам щось зробить.
  if (isBanning) {
    await db
      .update(jobs)
      .set({ status: "closed", updatedAt: new Date() })
      .where(
        and(
          eq(jobs.employerId, id),
          inArray(jobs.status, ["published", "pending_review", "draft"]),
        ),
      );
  }

  return NextResponse.json(updated);
}
