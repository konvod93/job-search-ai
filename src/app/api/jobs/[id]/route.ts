import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { generateEmbedding } from "@/lib/embeddings";
import { moderateJobListing } from "@/lib/moderation";
import { checkTrustGate } from "@/lib/trust-gate";
import { checkBundledRoles } from "@/lib/bundled-roles-check";
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

const updateJobSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  location: z.string().optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  subcategory: z.string().nullable().optional(),
  crossListedCategories: z.array(z.enum(CATEGORY_VALUES)).max(3).optional(),
  employmentType: z
    .enum(["full_time", "part_time", "contract", "internship", "remote"])
    .optional(),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  skillsRequired: z.array(z.string()).optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
});

async function getJobWithOwner(jobId: string) {
  const [row] = await db
    .select({
      job: jobs,
      employerUserId: employerProfiles.userId,
      employerType: employerProfiles.employerType,
      verificationStatus: employerProfiles.verificationStatus,
      banned: employerProfiles.banned,
    })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(eq(jobs.id, jobId))
    .limit(1);

  return row;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await getJobWithOwner(id);

  if (!row) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  return NextResponse.json(row.job);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const row = await getJobWithOwner(id);
  if (!row) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  if (row.employerUserId !== session.user.id) {
    return NextResponse.json(
      { error: "Немає прав на редагування цієї вакансії" },
      { status: 403 },
    );
  }

  if (row.banned) {
    return NextResponse.json(
      {
        error:
          "Ваш акаунт заблоковано за порушення правил платформи. Зверніться до підтримки, якщо вважаєте це помилкою.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = updateJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.subcategory) {
    const effectiveCategory = parsed.data.category ?? row.job.category;
    const validSubcategories = getSubcategoriesFor(effectiveCategory);
    if (!validSubcategories.some((s) => s.value === parsed.data.subcategory)) {
      return NextResponse.json(
        { error: "Підкатегорія не відповідає обраній категорії" },
        { status: 400 },
      );
    }
  }

  // Вакансія опублікована/публікується зараз → перевіряємо AI-модерацією
  // (використовуючи вже оновлений текст, якщо title/description змінились
  // у цьому запиті). "Fail open" при збої AI — не блокуємо employer'а.
  const targetStatus = parsed.data.status ?? row.job.status;
  const updates: {
    title?: string;
    description?: string;
    location?: string;
    category?: (typeof parsed.data)["category"];
    subcategory?: string | null;
    crossListedCategories?: string[];
    employmentType?: (typeof parsed.data)["employmentType"];
    salaryMin?: number;
    salaryMax?: number;
    skillsRequired?: string[];
    status?: "draft" | "published" | "closed" | "pending_review";
    moderationReason?: string | null;
    moderationCategory?:
      | "mlm"
      | "scam"
      | "spam"
      | "exploitation_risk"
      | "other"
      | null;
  } = { ...parsed.data };

  if (targetStatus === "published") {
    const title = parsed.data.title ?? row.job.title;
    const description = parsed.data.description ?? row.job.description;

    const bundledRoles = await checkBundledRoles(title, description);

    if (bundledRoles?.hasBundledRoles) {
      return NextResponse.json(
        {
          error: `Одне оголошення повинно описувати одну посаду. Знайдено кілька різних ролей: ${bundledRoles.rolesFound}. Створіть окреме оголошення для кожної посади.`,
        },
        { status: 403 },
      );
    }

    const moderation = await moderateJobListing(title, description, {
      min: parsed.data.salaryMin ?? row.job.salaryMin,
      max: parsed.data.salaryMax ?? row.job.salaryMax,
    });

    if (moderation?.flagged) {
      updates.status = "pending_review";
      updates.moderationReason = moderation.reason;
      updates.moderationCategory = moderation.category;
    } else if (moderation) {
      // Пройшло перевірку — прибираємо стару причину флагу, якщо була
      updates.moderationReason = null;
      updates.moderationCategory = null;
    }

    const isLowTrust =
      row.employerType === "fop" || row.verificationStatus !== "verified";

    if (isLowTrust) {
      const effectiveCategory = parsed.data.category ?? row.job.category;
      const effectiveSubcategory =
        parsed.data.subcategory !== undefined
          ? parsed.data.subcategory
          : row.job.subcategory;

      if (
        effectiveCategory === "security" &&
        effectiveSubcategory === "personal_security"
      ) {
        return NextResponse.json(
          {
            error:
              "Публікація вакансій охорони осіб (тілоохоронці) вимагає верифікації роботодавця. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.",
          },
          { status: 403 },
        );
      }

      if (
        effectiveCategory === "agriculture" &&
        effectiveSubcategory === "seasonal_harvest"
      ) {
        return NextResponse.json(
          {
            error:
              "Публікація сезонних сільгоспвакансій (збір врожаю тощо) вимагає верифікації роботодавця. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.",
          },
          { status: 403 },
        );
      }

      if (effectiveCategory === "government") {
        return NextResponse.json(
          {
            error:
              "Публікація вакансій у категорії \"Державні органи та служби\" вимагає верифікації роботодавця. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.",
          },
          { status: 403 },
        );
      }

      const trustGate = await checkTrustGate(title, description);

      if (trustGate?.hasExternalContact) {
        return NextResponse.json(
          {
            error: `Для ФОП та неверифікованих роботодавців заборонено вказувати в тексті вакансії посилання на сторонні канали зв'язку (Telegram, Viber тощо). Знайдено: "${trustGate.externalContactPhrase}". Приберіть це і спробуйте ще раз, або пройдіть верифікацію.`,
          },
          { status: 403 },
        );
      }

      if (
        trustGate?.isWomenEntertainmentRole &&
        row.verificationStatus !== "verified"
      ) {
        return NextResponse.json(
          {
            error:
              "Публікація вакансій моделі/танцівниці/співачки/акторки та подібних ролей вимагає верифікації роботодавця. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.",
          },
          { status: 403 },
        );
      }

      if (
        trustGate?.isSecurityDriverRole &&
        row.verificationStatus !== "verified"
      ) {
        return NextResponse.json(
          {
            error: `Вакансія "особистого водія" з ознаками охорони (зброя, силове водіння, досвід силових структур) вимагає верифікації роботодавця. Причина: ${trustGate.securityDriverReason}. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.`,
          },
          { status: 403 },
        );
      }

      if (
        trustGate?.isSuspiciousCourierRole &&
        row.verificationStatus !== "verified"
      ) {
        return NextResponse.json(
          {
            error: `Кур'єрська вакансія з ознаками, типовими для вербування в незаконні перевезення, вимагає верифікації роботодавця. Причина: ${trustGate.courierReason}. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.`,
          },
          { status: 403 },
        );
      }
    }
  }

  const [updated] = await db
    .update(jobs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();

  const embeddingRelevant =
    parsed.data.title !== undefined ||
    parsed.data.description !== undefined ||
    parsed.data.skillsRequired !== undefined;

  if (embeddingRelevant && updated) {
    try {
      const sourceText = [
        updated.title,
        (updated.skillsRequired ?? []).join(", "),
        updated.description,
      ]
        .filter(Boolean)
        .join("\n");

      const embedding = await generateEmbedding(sourceText);

      if (embedding) {
        await db.update(jobs).set({ embedding }).where(eq(jobs.id, id));
        updated.embedding = embedding;
      }
    } catch (err) {
      console.error("[jobs/[id]] embedding generation failed:", err);
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const row = await getJobWithOwner(id);
  if (!row) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  if (row.employerUserId !== session.user.id) {
    return NextResponse.json(
      { error: "Немає прав на видалення цієї вакансії" },
      { status: 403 },
    );
  }

  await db.delete(jobs).where(eq(jobs.id, id));

  return NextResponse.json({ success: true });
}
