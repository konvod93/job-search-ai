import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { candidateProfiles } from "@/db/schema";
import { generateEmbedding } from "@/lib/embeddings";
import { getSubcategoriesFor } from "@/lib/job-options";

const CATEGORY_VALUES = [
  "it",
  "construction",
  "manufacturing",
  "trade",
  "drivers",
  "logistics",
  "agriculture",
  "government",
  "accounting",
  "education",
  "military",
  "medical",
  "veterinary_medicine",
  "hospitality",
  "catering",
  "auto_service",
  "maintenance",
  "passenger_transport",
  "railway_transport",
  "maritime_transport",
  "culture",
  "science",
  "facilities_management",
  "show_business",
  "media",
  "service_staff",
  "security",
  "utilities",
  "legal",
  "management_marketing",
  "other",
] as const;

const updateProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
  preferredCategory: z.enum(CATEGORY_VALUES).nullable().optional(),
  preferredSubcategory: z.string().nullable().optional(),
  experienceYears: z.number().int().nonnegative().optional(),
  skills: z.array(z.string()).optional(),
  resumeText: z.string().optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "candidate") {
    return NextResponse.json(
      { error: "Доступно лише кандидатам" },
      { status: 403 },
    );
  }

  const [profile] = await db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Профіль не знайдено" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "candidate") {
    return NextResponse.json(
      { error: "Доступно лише кандидатам" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.preferredSubcategory) {
    let effectiveCategory = parsed.data.preferredCategory;
    if (effectiveCategory === undefined) {
      const [existing] = await db
        .select({ preferredCategory: candidateProfiles.preferredCategory })
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, session.user.id))
        .limit(1);
      effectiveCategory = existing?.preferredCategory ?? null;
    }
    const validSubcategories = effectiveCategory
      ? getSubcategoriesFor(effectiveCategory)
      : [];
    if (
      !validSubcategories.some((s) => s.value === parsed.data.preferredSubcategory)
    ) {
      return NextResponse.json(
        { error: "Підкатегорія не відповідає обраній категорії" },
        { status: 400 },
      );
    }
  }

  const [updated] = await db
    .update(candidateProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(candidateProfiles.userId, session.user.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Профіль не знайдено" }, { status: 404 });
  }

  // Оновлюємо embedding для семантичного матчингу, якщо змінились релевантні
  // поля. Не блокуємо збереження профілю, якщо генерація embedding впаде
  // (наприклад, немає OPENAI_API_KEY) — це некритична частина запиту.
  const embeddingRelevant =
    parsed.data.headline !== undefined ||
    parsed.data.skills !== undefined ||
    parsed.data.resumeText !== undefined;

  if (embeddingRelevant) {
    try {
      const sourceText = [
        updated.headline,
        (updated.skills ?? []).join(", "),
        updated.resumeText,
      ]
        .filter(Boolean)
        .join("\n");

      const embedding = await generateEmbedding(sourceText);

      if (embedding) {
        await db
          .update(candidateProfiles)
          .set({ embedding })
          .where(eq(candidateProfiles.id, updated.id));
      }
    } catch (err) {
      console.error("[candidate/profile] embedding generation failed:", err);
    }
  }

  return NextResponse.json(updated);
}
