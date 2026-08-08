import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles } from "@/db/schema";
import { FREE_TIER_EMPLOYER_TYPES } from "@/lib/job-options";

const EMPLOYER_TYPE_VALUES = [
  "commercial",
  "noncommercial",
  "military_security",
  "fop",
] as const;

const updateSchema = z
  .object({
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
    phone: z.string().optional(),
    phoneVisible: z.boolean().optional(),
    employerType: z.enum(EMPLOYER_TYPE_VALUES).optional(),
    edrpou: z
      .string()
      .refine(
        (val) => val === "" || /^\d{8,10}$/.test(val),
        "ЄДРПОУ/ІПН — 8-10 цифр",
      )
      .optional(),
  })
  .refine(
    (data) => !(data.edrpou && data.edrpou !== "" && !data.employerType),
    {
      message: "Оберіть тип роботодавця перед подачею номера",
      path: ["employerType"],
    },
  );

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

  const [existing] = await db
    .select({
      edrpou: employerProfiles.edrpou,
      employerType: employerProfiles.employerType,
      verificationStatus: employerProfiles.verificationStatus,
    })
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, session.user.id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Профіль не знайдено" }, { status: 404 });
  }

  // Якщо employer вписав/змінив реєстраційний номер — автоматично подаємо
  // на розгляд адміну. Якщо очистив поле — знімаємо верифікацію.
  let verificationStatus = existing.verificationStatus;
  if (parsed.data.edrpou !== undefined) {
    const newEdrpou = parsed.data.edrpou.trim();
    if (!newEdrpou) {
      verificationStatus = "unverified";
    } else if (newEdrpou !== existing.edrpou) {
      verificationStatus = "pending";
    }
  }

  const effectiveType = parsed.data.employerType ?? existing.employerType;
  const isFreeTier = effectiveType
    ? FREE_TIER_EMPLOYER_TYPES.has(effectiveType)
    : false;

  const [updated] = await db
    .update(employerProfiles)
    .set({ ...parsed.data, verificationStatus, isFreeTier, updatedAt: new Date() })
    .where(eq(employerProfiles.userId, session.user.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Профіль не знайдено" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
