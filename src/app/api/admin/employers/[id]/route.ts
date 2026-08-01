import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles } from "@/db/schema";

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
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

  const [updated] = await db
    .update(employerProfiles)
    .set({
      verificationStatus:
        parsed.data.action === "approve" ? "verified" : "rejected",
      verificationNote: parsed.data.note ?? null,
      updatedAt: new Date(),
    })
    .where(eq(employerProfiles.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Профіль не знайдено" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
