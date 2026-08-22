import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
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

const createJobSchema = z
  .object({
    title: z.string().min(1, "Вкажіть назву вакансії"),
    description: z.string().min(1, "Вкажіть опис вакансії"),
    location: z.string().optional(),
    category: z.enum(CATEGORY_VALUES),
    subcategory: z.string().optional(),
    crossListedCategories: z.array(z.enum(CATEGORY_VALUES)).max(3).optional(),
    employmentType: z.enum([
      "full_time",
      "part_time",
      "contract",
      "internship",
      "remote",
    ]),
    salaryMin: z.number().int().nonnegative().optional(),
    salaryMax: z.number().int().nonnegative().optional(),
    skillsRequired: z.array(z.string()).optional(),
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .refine(
    (data) => {
      if (!data.subcategory) return true;
      const valid = getSubcategoriesFor(data.category);
      return valid.some((s) => s.value === data.subcategory);
    },
    { message: "Підкатегорія не відповідає обраній категорії", path: ["subcategory"] },
  )
  .refine((data) => !data.crossListedCategories?.includes(data.category), {
    message: "Додаткова категорія не може дублювати основну",
    path: ["crossListedCategories"],
  });

// GET /api/jobs?q=...&location=...&employmentType=...&category=...
// Публічний перегляд — тільки опубліковані вакансії
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const location = searchParams.get("location");
  const employmentType = searchParams.get("employmentType");
  const category = searchParams.get("category");

  const filters = [eq(jobs.status, "published")];

  if (q) {
    filters.push(
      or(ilike(jobs.title, `%${q}%`), ilike(jobs.description, `%${q}%`))!,
    );
  }
  if (location) {
    filters.push(ilike(jobs.location, `%${location}%`));
  }
  if (
    employmentType &&
    [
      "full_time",
      "part_time",
      "contract",
      "internship",
      "remote",
    ].includes(employmentType)
  ) {
    filters.push(
      eq(
        jobs.employmentType,
        employmentType as
          | "full_time"
          | "part_time"
          | "contract"
          | "internship"
          | "remote",
      ),
    );
  }
  if (category && (CATEGORY_VALUES as readonly string[]).includes(category)) {
    filters.push(
      or(
        eq(jobs.category, category as (typeof CATEGORY_VALUES)[number]),
        sql`${jobs.crossListedCategories} @> ${JSON.stringify([category])}::jsonb`,
      )!,
    );
  }

  const results = await db
    .select()
    .from(jobs)
    .where(and(...filters))
    .orderBy(desc(jobs.createdAt))
    .limit(50);

  return NextResponse.json(results);
}

// POST /api/jobs — створення вакансії, тільки роль employer
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "employer") {
    return NextResponse.json(
      { error: "Тільки роботодавці можуть створювати вакансії" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = createJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [employerProfile] = await db
    .select({
      id: employerProfiles.id,
      verificationStatus: employerProfiles.verificationStatus,
      employerType: employerProfiles.employerType,
      banned: employerProfiles.banned,
    })
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, session.user.id))
    .limit(1);

  if (!employerProfile) {
    return NextResponse.json(
      { error: "Профіль роботодавця не знайдено" },
      { status: 404 },
    );
  }

  if (employerProfile.banned) {
    return NextResponse.json(
      {
        error:
          "Ваш акаунт заблоковано за порушення правил платформи. Зверніться до підтримки, якщо вважаєте це помилкою.",
      },
      { status: 403 },
    );
  }

  // Неверифіковані employer'и можуть мати лише одну вакансію — це
  // антифрод-обмеження, щоб шахрайський акаунт не міг залити платформу
  // спамом до того, як адмін встигне його перевірити.
  if (employerProfile.verificationStatus !== "verified") {
    const existingJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.employerId, employerProfile.id))
      .limit(1);

    if (existingJobs.length > 0) {
      return NextResponse.json(
        {
          error:
            "Неверифіковані роботодавці можуть опублікувати лише одну вакансію. Пройдіть верифікацію (ЄДРПОУ/ІПН у профілі), щоб публікувати більше.",
        },
        { status: 403 },
      );
    }
  }

  // AI-модерація: перевіряємо тільки коли employer намагається одразу
  // опублікувати (чернетку сенсу перевіряти немає — її ще ніхто не бачить).
  // При збої AI-перевірки навмисно "fail open" (пропускаємо як є) — щоб
  // тимчасова недоступність AI не блокувала легітимних роботодавців.
  let status: "draft" | "published" | "pending_review" = parsed.data.status;
  let moderationReason: string | null = null;
  let moderationCategory:
    | "mlm"
    | "scam"
    | "spam"
    | "exploitation_risk"
    | "other"
    | null = null;

  if (status === "published") {
    // Пакетування непов'язаних посад в одному оголошенні — універсальна
    // перевірка, для ВСІХ employer'ів (не тільки low-trust), бо легітимних
    // причин так робити практично немає. Жорсткий блок, не "на розгляд".
    const bundledRoles = await checkBundledRoles(
      parsed.data.title,
      parsed.data.description,
    );

    if (bundledRoles?.hasBundledRoles) {
      return NextResponse.json(
        {
          error: `Одне оголошення повинно описувати одну посаду. Знайдено кілька різних ролей: ${bundledRoles.rolesFound}. Створіть окреме оголошення для кожної посади.`,
        },
        { status: 403 },
      );
    }

    const moderation = await moderateJobListing(
      parsed.data.title,
      parsed.data.description,
      { min: parsed.data.salaryMin, max: parsed.data.salaryMax },
    );
    if (moderation?.flagged) {
      status = "pending_review";
      moderationReason = moderation.reason;
      moderationCategory = moderation.category;
    }

    // Trust-gate: додаткові жорсткі обмеження для роботодавців з низьким
    // рівнем довіри (ФОП незалежно від верифікації, або будь-хто
    // неверифікований). На відміну від moderateJobListing вище, це не
    // "відправити на розгляд", а прямий блок публікації з чіткою причиною.
    const isLowTrust =
      employerProfile.employerType === "fop" ||
      employerProfile.verificationStatus !== "verified";

    if (isLowTrust) {
      // Пряма структурна перевірка (без AI) — категорія вже явно каже, що
      // це охорона осіб, тож не треба вгадувати з тексту, як для водія.
      // Ризик вербування в кримінал під виглядом тілоохоронця той самий.
      if (
        parsed.data.category === "security" &&
        parsed.data.subcategory === "personal_security"
      ) {
        return NextResponse.json(
          {
            error:
              "Публікація вакансій охорони осіб (тілоохоронці) вимагає верифікації роботодавця. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.",
          },
          { status: 403 },
        );
      }

      // Сезонна сільгоспробота (збір врожаю тощо) — класичний вектор
      // трудового рабства/трафікінгу. Теж пряма структурна перевірка.
      if (
        parsed.data.category === "agriculture" &&
        parsed.data.subcategory === "seasonal_harvest"
      ) {
        return NextResponse.json(
          {
            error:
              "Публікація сезонних сільгоспвакансій (збір врожаю тощо) вимагає верифікації роботодавця. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.",
          },
          { status: 403 },
        );
      }

      // Держоргани — гейт на ВСЮ категорію, не на підкатегорію: ФОП чи
      // неверифікований акаунт не повинен публікувати нічого від імені
      // міністерства/держслужби/правоохоронних органів (типовий приклад
      // шахрайства — фейкова вакансія "експерт у міністерство оборони").
      if (parsed.data.category === "government") {
        return NextResponse.json(
          {
            error:
              "Публікація вакансій у категорії \"Державні органи та служби\" вимагає верифікації роботодавця. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.",
          },
          { status: 403 },
        );
      }

      const trustGate = await checkTrustGate(
        parsed.data.title,
        parsed.data.description,
      );

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
        employerProfile.verificationStatus !== "verified"
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
        employerProfile.verificationStatus !== "verified"
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
        employerProfile.verificationStatus !== "verified"
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

  const [job] = await db
    .insert(jobs)
    .values({
      employerId: employerProfile.id,
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      category: parsed.data.category,
      subcategory: parsed.data.subcategory,
      crossListedCategories: parsed.data.crossListedCategories ?? [],
      employmentType: parsed.data.employmentType,
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      skillsRequired: parsed.data.skillsRequired ?? [],
      status,
      moderationReason,
      moderationCategory,
    })
    .returning();

  // Embedding для семантичного матчингу з кандидатами. Некритична частина
  // запиту — вакансія вже створена, помилка генерації не повинна ламати
  // основний флоу.
  try {
    const sourceText = [
      job.title,
      (job.skillsRequired ?? []).join(", "),
      job.description,
    ]
      .filter(Boolean)
      .join("\n");

    const embedding = await generateEmbedding(sourceText);

    if (embedding) {
      await db.update(jobs).set({ embedding }).where(eq(jobs.id, job.id));
      job.embedding = embedding;
    }
  } catch (err) {
    console.error("[jobs] embedding generation failed:", err);
  }

  return NextResponse.json(job, { status: 201 });
}
