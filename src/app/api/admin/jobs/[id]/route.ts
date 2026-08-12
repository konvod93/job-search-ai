import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { jobs } from "@/db/schema";

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
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

  const setValues: {
    status: "published" | "closed";
    updatedAt: Date;
    moderationReason?: null;
    moderationCategory?: null;
    rejectedByAdmin?: boolean;
  } = {
    status: parsed.data.action === "approve" ? "published" : "closed",
    updatedAt: new Date(),
  };

  if (parsed.data.action === "approve") {
    setValues.moderationReason = null;
    setValues.moderationCategory = null;
  } else {
    // Відхилено адміном (не сам employer закрив, не прийнята скарга) —
    // рахується окремо для /admin/bans (3+ відхилень = кандидат на бан).
    setValues.rejectedByAdmin = true;
  }

  const [updated] = await db
    .update(jobs)
    .set(setValues)
    .where(eq(jobs.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
