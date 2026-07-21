import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, candidateProfiles, employerProfiles } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { eq } from "drizzle-orm";

const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("candidate"),
    email: z.email(),
    password: z.string().min(8, "Пароль має містити мінімум 8 символів"),
    fullName: z.string().min(1, "Вкажіть ім'я"),
  }),
  z.object({
    role: z.literal("employer"),
    email: z.email(),
    password: z.string().min(8, "Пароль має містити мінімум 8 символів"),
    companyName: z.string().min(1, "Вкажіть назву компанії"),
  }),
]);

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Користувач з таким email вже існує" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(data.password);

  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash,
      role: data.role,
    })
    .returning({ id: users.id, email: users.email, role: users.role });

  // Примітка: neon-http драйвер не підтримує interactive-транзакції,
  // тому створення профілю йде окремим запитом після users.
  if (data.role === "candidate") {
    await db.insert(candidateProfiles).values({
      userId: user.id,
      fullName: data.fullName,
    });
  } else {
    await db.insert(employerProfiles).values({
      userId: user.id,
      companyName: data.companyName,
    });
  }

  return NextResponse.json(
    { id: user.id, email: user.email, role: user.role },
    { status: 201 },
  );
}
