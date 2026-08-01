import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles } from "@/db/schema";

const updateSchema = z.object({
  companyName: z.string().min(1).optional(),
  companyDescription: z.string().optional(),
  website: z
    .string()
    .refine(
      (val) => val === "" || z.url().safeParse(val).success,
      "Некоректний URL",
    )
    .optional(),
  location: z.string().optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "employer") {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const [profile] = await db
    .select()
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Профіль не знайдено" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "employer") {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(employerProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(employerProfiles.userId, session.user.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Профіль не знайдено" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
