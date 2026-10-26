import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { generateEmbedding } from "@/lib/embeddings";
import { moderateJobListing, hasObviousExploitationRiskPattern, hasBannedRepertoireRiskPattern, hasPhysicalDebtCollectionPattern, hasNotaryPositionTitle, hasIllegalMedicalPracticePattern, hasPrivateHomeCarePattern, mentionsMedicalManipulations, mentionsCareMonitoring } from "@/lib/moderation";
import {
  checkTrustGate,
  checkBusinessActivityMismatch,
  hasObviousEntertainmentRoleKeyword,
  matchesLicensedFishingActivity,
  matchesShowBusinessActivity,
  matchesFacilityServiceActivity,
  mentionsResidentialPremise,
  findNarrowSpecialistInTitle,
  matchesMedicalActivity,
  titleImpliesMedicalPractice,
  matchesCareServiceActivity,
} from "@/lib/trust-gate";
import { checkBundledRoles } from "@/lib/bundled-roles-check";
import {
  getSubcategoriesFor,
  requiresAgencyVerification,
  requiresVerificationOnly,
  isGovernmentAuthorityRole,
  isFishingSubcategory,
  isFacilityServicePrivateHireRiskSubcategory,
  requiresMedicalLicense,
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
  "office_administration",
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
      collectionRegistryNumber: employerProfiles.collectionRegistryNumber,
      medicalLicenseNumber: employerProfiles.medicalLicenseNumber,
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
    | "banned_repertoire_risk"
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
    } else if (
      moderation === null &&
      hasBannedRepertoireRiskPattern(
        parsed.data.title,
        parsed.data.description,
      )
    ) {
      // Той самий принцип фолбеку — див. коментар біля
      // hasBannedRepertoireRiskPattern у moderation.ts.
      console.error(
        "[jobs] moderateJobListing повернув null (AI недоступний) — спрацював keyword-фолбек banned_repertoire_risk.",
      );
      status = "pending_review";
      moderationCategory = "banned_repertoire_risk";
      moderationReason =
        "Виявлено за ключовими словами (вимога репертуару рос. шансону/блатняку — публічне виконання законодавчо обмежене) — AI-модерація була недоступна, потрібен ручний розгляд.";
    }

    // Вимога "вибивати борги" фізичним/силовим впливом — найм у неправову
    // структуру. Завжди увімкнено, незалежно від категорії й типу
    // роботодавця (див. hasPhysicalDebtCollectionPattern у moderation.ts).
    if (
      hasPhysicalDebtCollectionPattern(
        parsed.data.title,
        parsed.data.description,
      )
    ) {
      status = "pending_review";
      moderationCategory = "other";
      moderationReason =
        "Вакансія вимагає стягнення боргів із ознаками фізичного/силового тиску або залякування (вибивання боргів) — законна колекторська діяльність таких методів не передбачає. Потрібен ручний розгляд, можливий найм у неправову структуру.";
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

    // Клінінг / догляд за територією / обслуговування будівель: навіть
    // верифікований ФОП може ховати приватний домашній найм під
    // виглядом бізнес-вакансії — див. детальний коментар біля
    // matchesFacilityServiceActivity/mentionsResidentialPremise у
    // trust-gate.ts. Спочатку довіряємо businessActivity (профільний
    // бізнес — ок, навіть якщо текст згадує чиюсь квартиру), і лише якщо
    // бізнес НЕ профільний — перевіряємо, чи сам текст описує приватний
    // житловий об'єкт. Юросіб ця перевірка не стосується — тільки ФОП.
    if (
      isFacilityServicePrivateHireRiskSubcategory(
        parsed.data.category,
        parsed.data.subcategory,
      ) &&
      employerProfile.employerType === "fop"
    ) {
      const activity = employerProfile.businessActivity?.trim() ?? "";
      const isOwnProfileBusiness =
        !!activity && matchesFacilityServiceActivity(activity);

      if (
        !isOwnProfileBusiness &&
        mentionsResidentialPremise(parsed.data.title, parsed.data.description)
      ) {
        status = "pending_review";
        moderationCategory = "other";
        moderationReason =
          'Вакансія від ФОП у сфері обслуговування, клінінгу чи ЖКГ, чий заявлений вид діяльності не пов\'язаний з цією сферою, а текст описує приватний житловий об\'єкт (квартира/будинок/котедж) — схоже на приватний найм під виглядом бізнес-категорії. Потрібен ручний розгляд.';
      }
    }

    // Медицина: медична практика без ліцензії незаконна, а лікарів без
    // ліцензованого роботодавця шукають і кримінальні структури. Вимога
    // стосується БУДЬ-ЯКОГО роботодавця — зокрема підприємства зі штатним
    // медпунктом (не аутсорс). Не питання довіри, тож поза isLowTrust.
    if (
      requiresMedicalLicense(parsed.data.category, parsed.data.subcategory) &&
      !employerProfile.medicalLicenseNumber?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Публікація вакансій лікарів і медперсоналу вимагає ліцензії на господарську діяльність з медичної практики. Вкажіть номер ліцензії у профілі роботодавця. Це стосується й підприємств зі штатним медпунктом; якщо медогляди на аутсорсі, вакансію публікує медзаклад, що їх виконує.",
        },
        { status: 403 },
      );
    }

    // Медсестра / медбрат / сиділка поза категорією "Медицина": без цього
    // приватна особа, що шукає медсестру робити уколи діду чи сиділку,
    // обирає будь-яку категорію без гейту. Така вакансія — теж медична
    // практика: лише верифікований роботодавець з ліцензією. Військова
    // категорія виключена (військові шпиталі — окремий гейт юрособи).
    if (
      titleImpliesMedicalPractice(
        parsed.data.category,
        parsed.data.subcategory,
        parsed.data.title,
      ) &&
      (employerProfile.verificationStatus !== "verified" ||
        !employerProfile.medicalLicenseNumber?.trim())
    ) {
      return NextResponse.json(
        {
          error:
            'Вакансії медсестер, медбратів і сиділок — це медична практика: публікуйте їх у категорії "Медицина та охорона здоров\'я" як верифікований роботодавець з ліцензією (номер ліцензії вкажіть у профілі). Побутовий догляд без медичних маніпуляцій (готування, прибирання, супровід) публікують верифіковані агенції та ФОП з відповідним видом діяльності в підкатегорії патронажного догляду категорії \"Обслуговуючий персонал та клінінг\". Пошук медсестри чи сиділки для догляду вдома приватною особою на платформі не підтримується.',
        },
        { status: 403 },
      );
    }

    // Догляд за конкретним родичем замовника в медичній вакансії від
    // не-медичного роботодавця — ознака приватного найму. Медичний
    // роботодавець (клініка, лікарня) не перевіряється: там тексти про
    // пацієнтів звичайні.
    const isPatronage =
      parsed.data.category === "service_staff" &&
      parsed.data.subcategory === "patronage_social_care";
    if (
      (parsed.data.category === "medical" || isPatronage) &&
      status !== "pending_review" &&
      hasPrivateHomeCarePattern(parsed.data.title, parsed.data.description)
    ) {
      const activity = employerProfile.businessActivity?.trim() ?? "";
      // Для медичного роботодавця (клініка) такі тексти звичайні; для
      // агенції патронажу винятку немає — вона не пише "мого діда".
      if (isPatronage || !(activity && matchesMedicalActivity(activity))) {
        status = "pending_review";
        moderationCategory = "other";
        moderationReason =
          "Вакансія догляду описує догляд за конкретним родичем замовника — ознака приватного найму, а не роботи агенції чи закладу. Потрібен ручний розгляд.";
      }
    }

    // ФОП у патронажі: надання послуг догляду — легальна діяльність, але
    // лише якщо заявлений вид діяльності це підтверджує (догляд/
    // соціальна допомога/медична практика). Інакше це приватна особа з
    // ФОП в іншій сфері (електрик, торгівля), що шукає доглядальницю
    // собі. Юросіб ця перевірка не стосується.
    if (isPatronage && employerProfile.employerType === "fop") {
      const careActivity = employerProfile.businessActivity?.trim() ?? "";
      if (!careActivity || !matchesCareServiceActivity(careActivity)) {
        return NextResponse.json(
          {
            error:
              'Публікація вакансій доглядальниці від ФОП можлива, лише якщо заявлений вид діяльності це підтверджує (догляд за особами похилого віку/хворими, соціальна допомога тощо). Оновіть поле "Вид діяльності" у профілі — це знову відправить профіль на верифікацію адміном.',
          },
          { status: 403 },
        );
      }
    }

    // Медичні маніпуляції (уколи, крапельниці, ін'єкції, перев'язки,
    // катетер, медичні процедури, реабілітація) в обов'язках: це вже
    // медпрацівник, і роботодавець (ФОП чи юрособа) має мати ліцензію на
    // медичну практику. Лише побутові обов'язки ліцензії не потребують.
    // М'яко (модерація), бо детекція за ключовими словами. Ліцензований
    // роботодавець — без перевірки.
    if (
      isPatronage &&
      status !== "pending_review" &&
      !employerProfile.medicalLicenseNumber?.trim() &&
      mentionsMedicalManipulations(parsed.data.title, parsed.data.description)
    ) {
      status = "pending_review";
      moderationCategory = "other";
      moderationReason =
        "Вакансія патронажного догляду містить медичні маніпуляції (ін'єкції, перев'язки, катетери тощо) або вимагає медичної кваліфікації (медсестра/медбрат, диплом, медична освіта), але роботодавець без ліцензії на медичну практику. Така сиділка — медпрацівник: вакансію слід публікувати в категорії \"Медицина\" від ліцензованого роботодавця, або прибрати медичні обов'язки. Потрібен ручний розгляд.";
    }

    // Змішаний варіант: побутова доглядальниця, але є вимірювання
    // тиску/цукру, журнал спостереження — завжди на модерацію (незалежно
    // від ліцензії), бо це межа між побутовим і медичним доглядом.
    if (
      isPatronage &&
      status !== "pending_review" &&
      mentionsCareMonitoring(parsed.data.title, parsed.data.description)
    ) {
      status = "pending_review";
      moderationCategory = "other";
      moderationReason =
        "Вакансія подана як побутовий догляд, але серед обов'язків є моніторинг стану здоров'я (вимірювання тиску чи цукру, журнал спостереження). Це межовий випадок між побутовим доглядом і медичною діяльністю — потрібен ручний розгляд.";
    }

    // Ознаки нелегальної медичної практики (допомога пораненим поза
    // законом, нелегальна трансплантація) — завжди, див.
    // hasIllegalMedicalPracticePattern у moderation.ts.
    if (
      hasIllegalMedicalPracticePattern(
        parsed.data.title,
        parsed.data.description,
      )
    ) {
      status = "pending_review";
      moderationCategory = "other";
      moderationReason =
        "Вакансія медпрацівника з ознаками нелегальної медичної практики (допомога пораненим без звернення до правоохоронців, підпільна клініка чи нелегальна трансплантація). Потрібен ручний розгляд.";
    }

    // Вузький спеціаліст на повну ставку у не-медичного роботодавця
    // (завод шукає ЛОРа чи офтальмолога в медпункт) — найімовірніше
    // помилка: малося на увазі сумісництво. Див. findNarrowSpecialistInTitle
    // у trust-gate.ts.
    if (
      parsed.data.category === "medical" &&
      (parsed.data.subcategory === "doctors" ||
        parsed.data.subcategory === "occupational_industrial_medicine") &&
      parsed.data.employmentType === "full_time" &&
      status !== "pending_review"
    ) {
      const narrow = findNarrowSpecialistInTitle(parsed.data.title);
      const activity = employerProfile.businessActivity?.trim() ?? "";
      const isMedicalEmployer = !!activity && matchesMedicalActivity(activity);
      const isCompanyMedpunkt =
        parsed.data.subcategory === "occupational_industrial_medicine";
      if (narrow && !isMedicalEmployer && (isCompanyMedpunkt || !!activity)) {
        status = "pending_review";
        moderationCategory = "other";
        moderationReason = `Можлива помилка: вузький спеціаліст ("${narrow}") на повну зайнятість у медпункт підприємства виглядає сумнівно — таких лікарів зазвичай залучають за сумісництвом або за договором. Скоріш за все, малося на увазі роботу за сумісництвом. Змініть тип зайнятості або підтвердіть потребу — вакансію відправлено на перевірку.`;
      }
    }

    // "Нотаріус" як посада поза державною службою — це не найм (приватний
    // нотаріус самозайнятий), див. hasNotaryPositionTitle у moderation.ts.
    // Державна нотаріальна служба — категорія government, там дозволено.
    if (
      parsed.data.category !== "government" &&
      hasNotaryPositionTitle(parsed.data.title) &&
      status !== "pending_review"
    ) {
      status = "pending_review";
      moderationCategory = "other";
      moderationReason =
        'Вакансія "нотаріус" поза державною нотаріальною службою: нотаріус на посаду наймається лише там, а приватний нотаріус — самозайнята особа, і співпраця з ним є партнерством, а не наймом. Якщо потрібен помічник чи секретар нотаріуса — вкажіть це в назві; для державної контори оберіть категорію "Державні органи та служби".';
    }

    // Колектори: легальна колекторська компанія значиться в реєстрі НБУ
    // (закон 1349-IX). Без номера не блокуємо — кредитори (банки,
    // фінкомпанії) стягують борги власними службами й у цьому реєстрі
    // не значаться — а відправляємо на ручний розгляд, щоб адмін
    // перевірив, чи це кредитор, а не неправова структура. Не затираємо
    // вже виставлену причину (напр. фізичний тиск) — вона серйозніша.
    if (
      parsed.data.category === "legal" &&
      parsed.data.subcategory === "legal_debt_collection" &&
      !employerProfile.collectionRegistryNumber?.trim() &&
      status !== "pending_review"
    ) {
      status = "pending_review";
      moderationCategory = "other";
      moderationReason =
        "Вакансія колектора від роботодавця без номера в реєстрі колекторських компаній НБУ — потрібно перевірити, що це кредитор (банк/фінкомпанія зі своєю службою стягнення), а не колектор поза реєстром.";
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

    // Шоу-бізнес — приватного найму тут немає в принципі (не питання
    // довіри одного конкретного оголошення, а структурна вимога до ВСІЄЇ
    // категорії), тому гейт теж поза isLowTrust і застосовується завжди.
    if (parsed.data.category === "show_business") {
      if (employerProfile.verificationStatus !== "verified") {
        return NextResponse.json(
          {
            error:
              "Публікація вакансій у категорії \"Шоу-бізнес та індустрії розваг\" вимагає верифікації роботодавця. Наймати можуть лише продюсерські центри, івент-агенції, телерадіокомпанії, кіностудії, звукозаписні лейбли та ліцензовані модельні агенції — пройдіть верифікацію (ЄДРПОУ/ІПН) у профілі.",
          },
          { status: 403 },
        );
      }
      if (employerProfile.employerType === "fop") {
        const activity = employerProfile.businessActivity?.trim() ?? "";
        if (!activity || !matchesShowBusinessActivity(activity)) {
          return NextResponse.json(
            {
              error:
                'Заявлений вид діяльності у профілі не відповідає профілю шоу-бізнесу/медіа (продюсування, відео/кіновиробництво, агентська чи концертна діяльність тощо). Оновіть поле "Вид діяльності" — це знову відправить профіль на верифікацію адміном.',
            },
            { status: 403 },
          );
        }
      }
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
              "Ця роль вимагає верифікованої юрособи (не ФОП і не анонімний акаунт) — через один з таких ризиків: прямий приватний найм (домашній персонал/водій/охорона тощо, де потрібен посередник для перевірки кандидатів), регуляторний статус (каса/обмін валют/ломбард вимагають ліцензії, колекторська діяльність — внесення до реєстру НБУ; цього в ФОП не буває), підвищений ризик вербування в трафікінг під легальним на вигляд оголошенням (аніматор/масажист за кордоном тощо), або те, що роботодавець — судно/порт (палубна, машинна команда, судновий сервіс, портове господарство — судновласником чи портовим оператором не буває ФОП). Приватний найм фізособою чи ФОП тут не підтримується.",
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
