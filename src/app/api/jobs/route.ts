import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { generateEmbedding } from "@/lib/embeddings";
import { moderateJobListing, hasObviousExploitationRiskPattern } from "@/lib/moderation";
import {
  checkTrustGate,
  checkBusinessActivityMismatch,
  hasObviousEntertainmentRoleKeyword,
  matchesLicensedFishingActivity,
} from "@/lib/trust-gate";
import { checkBundledRoles } from "@/lib/bundled-roles-check";
import {
  getSubcategoriesFor,
  requiresAgencyVerification,
  requiresVerificationOnly,
  isGovernmentAuthorityRole,
  isFishingSubcategory,
} from "@/lib/job-options";

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
    serviceCenterTier: z.enum(["dealer", "network", "private"]).optional(),
    fleetType: z
      .enum(["river", "coastal_cabotage", "ocean_going", "cruise_passenger"])
      .optional(),
    isForeignVesselCrewing: z.boolean().optional(),
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
  })
  .refine(
    (data) => !data.serviceCenterTier || data.category === "auto_service",
    {
      message: "Рівень СТО можна вказати лише для категорії \"Автосервіс / СТО\"",
      path: ["serviceCenterTier"],
    },
  )
  .refine(
    (data) => !data.fleetType || data.category === "maritime_transport",
    {
      message:
        'Тип флоту можна вказати лише для категорії "Морський та річковий транспорт"',
      path: ["fleetType"],
    },
  )
  .refine(
    (data) =>
      !data.isForeignVesselCrewing || data.category === "maritime_transport",
    {
      message:
        'Позначку "судно під іноземним прапором" можна вказати лише для категорії "Морський та річковий транспорт"',
      path: ["isForeignVesselCrewing"],
    },
  );

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
      businessActivity: employerProfiles.businessActivity,
      foreignEmploymentLicenseNumber:
        employerProfiles.foreignEmploymentLicenseNumber,
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
    } else if (
      moderation === null &&
      hasObviousExploitationRiskPattern(
        parsed.data.title,
        parsed.data.description,
      )
    ) {
      // AI-модерація впала (немає ANTHROPIC_API_KEY, мережа тощо) — не
      // залишаємо найнебезпечніший патерн (вік+зовнішність без
      // професійного обґрунтування) зовсім без захисту. Див. коментар
      // біля hasObviousExploitationRiskPattern у moderation.ts.
      console.error(
        "[jobs] moderateJobListing повернув null (AI недоступний) — спрацював keyword-фолбек exploitation_risk.",
      );
      status = "pending_review";
      moderationCategory = "exploitation_risk";
      moderationReason =
        "Виявлено за ключовими словами (віковий діапазон + вимога до зовнішності без професійного обґрунтування) — AI-модерація була недоступна, потрібен ручний розгляд.";
    }

    // Ролі, де достатньо звичайної верифікації (ФОП з ліцензією — ок), але
    // анонім/неверифікований — ні. Перевіряється НЕЗАЛЕЖНО від isLowTrust
    // нижче, бо верифікований ФОП взагалі не потрапляє в той блок — а тут
    // саме такий кейс і треба зловити (verified required, FOP дозволений).
    if (
      requiresVerificationOnly(parsed.data.category, parsed.data.subcategory) &&
      employerProfile.verificationStatus !== "verified"
    ) {
      return NextResponse.json(
        {
          error:
            "Ця роль вимагає ліцензованої діяльності — публікувати можуть лише верифіковані роботодавці (юрособа або ФОП з відповідною ліцензією). Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі.",
        },
        { status: 403 },
      );
    }

    // Крюїнг за кордон — юридична вимога, а не питання довіри: навіть
    // повністю верифікована юрособа не має права посередництва у
    // працевлаштуванні моряків на судна під іноземним прапором без
    // ліцензії Мінекономіки. Тому перевірка стоїть окремо від isLowTrust
    // нижче й застосовується до БУДЬ-ЯКОГО роботодавця.
    if (
      parsed.data.category === "maritime_transport" &&
      parsed.data.isForeignVesselCrewing &&
      !employerProfile.foreignEmploymentLicenseNumber?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            'Публікація вакансій на судна під іноземним прапором (крюїнг за кордон) вимагає ліцензії Мінекономіки на посередництво у працевлаштуванні за кордоном. Вкажіть номер ліцензії у профілі роботодавця.',
        },
        { status: 403 },
      );
    }

    // Trust-gate: додаткові жорсткі обмеження для роботодавців з низьким
    // рівнем довіри (ФОП незалежно від верифікації, або будь-хто
    // неверифікований). На відміну від moderateJobListing вище, це не
    // "відправити на розгляд", а прямий блок публікації з чіткою причиною.
    const isLowTrust =
      employerProfile.employerType === "fop" ||
      employerProfile.verificationStatus !== "verified";

    if (isLowTrust) {
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

      // Держоргани — гейт на ВСЮ категорію "government", а також на
      // окремі підкатегорії поза нею, які по суті теж держслужби
      // (санепідслужба та Держпродспоживслужба в категорії "медицина"):
      // ФОП чи неверифікований акаунт не повинен публікувати нічого від
      // імені міністерства/держслужби/правоохоронних органів (типовий
      // приклад шахрайства — фейкова вакансія "експерт у міністерство
      // оборони").
      if (
        isGovernmentAuthorityRole(parsed.data.category, parsed.data.subcategory)
      ) {
        return NextResponse.json(
          {
            error:
              "Публікація вакансій від імені державних органів та служб (зокрема державної санітарно-епідеміологічної служби та Держпродспоживслужби) вимагає верифікації роботодавця. Пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі, щоб опублікувати цю вакансію.",
          },
          { status: 403 },
        );
      }

      // Військові вакансії — гейт на ВСЮ категорію: жодних анонімів/ФОП,
      // лише верифіковані юрособи (в/ч, підрозділи ЗСУ/Нацгвардії/ССО/
      // Нацполіції тощо, або офіційні рекрутингові центри). Пошта на
      // домені mil.gov.ua — додатковий сигнал довіри для адміна (не
      // обов'язковий, бо не всі силові структури під Міноборони). Якщо
      // публікує сама в/ч (не рекрутинговий центр) — адмін має додатково
      // попросити підтвердний документ за підписом командира поза
      // платформою (файлового аплоуду в проекті немає, це ручний процес).
      if (parsed.data.category === "military") {
        return NextResponse.json(
          {
            error:
              "Публікація військових вакансій вимагає верифікації роботодавця як юридичної особи (в/ч, підрозділ силових структур або офіційний рекрутинговий центр). Анонімні акаунти та ФОП тут не підтримуються.",
          },
          { status: 403 },
        );
      }

      // Ролі, де кінцевий "роботодавець" по суті приватна особа (няня,
      // гувернер, репетитор, особистий водій, тілоохоронець, домашній
      // персонал) — лише через верифіковані ЮРОСОБИ (агенції, що беруть
      // на себе перевірку кандидатів: документи, мед- і психогляд). ФОП
      // тут недостатньо, навіть верифікований — isLowTrust вже покриває
      // ФОП незалежно від verificationStatus.
      if (
        requiresAgencyVerification(
          parsed.data.category,
          parsed.data.subcategory,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Ця роль вимагає верифікованої юрособи (не ФОП і не анонімний акаунт) — через один з таких ризиків: прямий приватний найм (домашній персонал/водій/охорона тощо, де потрібен посередник для перевірки кандидатів), регуляторний статус (каса/обмін валют/ломбард вимагають ліцензії, якої в ФОП не буває), підвищений ризик вербування в трафікінг під легальним на вигляд оголошенням (аніматор/масажист за кордоном тощо), або те, що роботодавець — судно/порт (палубна, машинна команда, судновий сервіс, портове господарство — судновласником чи портовим оператором не буває ФОП). Приватний найм фізособою чи ФОП тут не підтримується.",
          },
          { status: 403 },
        );
      }

      // Промислове рибальство — єдиний виняток у категорії
      // maritime_transport, де ФОП дозволені (решта підкатегорій — лише
      // юрособи, requiresAgencyVerification вище). Але верифікація тут
      // має конкретно підтверджувати ліцензований вилов риби, інакше
      // неверифікований чи "не той" ФОП може виявитись браконьєром.
      if (
        isFishingSubcategory(parsed.data.category, parsed.data.subcategory) &&
        employerProfile.employerType === "fop"
      ) {
        if (employerProfile.verificationStatus !== "verified") {
          return NextResponse.json(
            {
              error:
                "Публікація вакансій промислового рибальства від ФОП вимагає верифікації, яка конкретно підтверджує ліцензований вилов риби (щоб виключити браконьєрство). Пройдіть верифікацію (ІПН) у профілі й вкажіть вид діяльності.",
            },
            { status: 403 },
          );
        }
        const activity = employerProfile.businessActivity?.trim() ?? "";
        if (!activity || !matchesLicensedFishingActivity(activity)) {
          return NextResponse.json(
            {
              error:
                'Заявлений вид діяльності у профілі не підтверджує ліцензований вилов риби/аквакультуру. Оновіть поле "Вид діяльності" (наприклад, "рибальство", "рибне господарство", "аквакультура") — це знову відправить профіль на верифікацію адміном.',
            },
            { status: 403 },
          );
        }
      }

      const trustGate = await checkTrustGate(
        parsed.data.title,
        parsed.data.description,
      );

      // Якщо AI-перевірка не спрацювала (trustGate === null), не
      // залишаємо категорію "жіночих" ролей у шоу-бізнесі без жодного
      // захисту — підстраховуємось детермінованим пошуком ключових слів
      // у назві/описі. Для решти трьох ознак (контакти, водій-охорона,
      // кур'єр) лишаємо fail-open як і було — це свідомий компроміс заради
      // доступності, тут же ризик достатньо серйозний для винятку.
      const isWomenEntertainmentRole =
        trustGate?.isWomenEntertainmentRole ??
        hasObviousEntertainmentRoleKeyword(
          parsed.data.title,
          parsed.data.description,
        );
      const entertainmentReason =
        trustGate?.entertainmentReason ??
        (isWomenEntertainmentRole
          ? "виявлено за ключовим словом у назві/описі (AI-перевірка була недоступна)"
          : null);

      if (trustGate === null) {
        console.error(
          "[jobs] checkTrustGate повернув null (AI недоступний) — перевірте ANTHROPIC_API_KEY. Fallback за ключовими словами для is_women_entertainment_role:",
          isWomenEntertainmentRole,
        );
      }

      if (trustGate?.hasExternalContact) {
        return NextResponse.json(
          {
            error: `Для ФОП та неверифікованих роботодавців заборонено вказувати в тексті вакансії посилання на сторонні канали зв'язку (Telegram, Viber тощо). Знайдено: "${trustGate.externalContactPhrase}". Приберіть це і спробуйте ще раз, або пройдіть верифікацію.`,
          },
          { status: 403 },
        );
      }

      if (
        isWomenEntertainmentRole &&
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

      // Верифікований ФОП (не заблокований вище) уже пройшов базову
      // перевірку особи, але для цих ролей цього замало — фотограф-
      // фрилансер, що знімає портфоліо моделі, відеоблогер, що наймає
      // акторку, чи продюсер гурту, що шукає співачку — все це легітимний
      // ФОП. А ФОП з видом діяльності "роздрібна торгівля", що раптом
      // наймає акторку, — підозра на прикриття для вербування. Замість
      // жорсткого блоку відправляємо на ручну модерацію адміну (не 403),
      // якщо заявлений вид діяльності не узгоджується з роллю. Юрособ ця
      // перевірка не стосується — там і так лише верифікована юрособа.
      if (
        isWomenEntertainmentRole &&
        employerProfile.employerType === "fop"
      ) {
        const activity = employerProfile.businessActivity?.trim() ?? "";
        const mismatch = activity
          ? await checkBusinessActivityMismatch(
              parsed.data.title,
              parsed.data.description,
              activity,
            )
          : null;

        // Порожній activity, збій AI (null) чи явний мисметч — усі три
        // трактуються як "потрібен ручний розгляд", навмисно не fail-open
        // тут (див. коментар у trust-gate.ts).
        if (!activity || mismatch === null || mismatch.isMismatch) {
          status = "pending_review";
          moderationCategory = "exploitation_risk";
          moderationReason = !activity
            ? `ФОП публікує вакансію "${entertainmentReason}", але не вказав вид діяльності в профілі — потрібна ручна перевірка відповідності КВЕД.`
            : mismatch === null
              ? `ФОП публікує вакансію "${entertainmentReason}" (заявлений вид діяльності: "${activity}") — автоматична перевірка відповідності не спрацювала, потрібен ручний розгляд.`
              : `ФОП публікує вакансію "${entertainmentReason}", але заявлений вид діяльності ("${activity}") їй не відповідає: ${mismatch.reason}`;
        }
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
      serviceCenterTier: parsed.data.serviceCenterTier,
      fleetType: parsed.data.fleetType,
      isForeignVesselCrewing: parsed.data.isForeignVesselCrewing ?? false,
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
