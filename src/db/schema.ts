import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  pgEnum,
  integer,
  vector,
  jsonb,
  real,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------

export const userRoleEnum = pgEnum("user_role", [
  "candidate",
  "employer",
  "admin",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "remote",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "pending_review",
  "published",
  "closed",
]);

export const jobCategoryEnum = pgEnum("job_category", [
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
]);

export const moderationCategoryEnum = pgEnum("moderation_category", [
  "mlm",
  "scam",
  "spam",
  "exploitation_risk",
  "other",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "applied",
  "viewed",
  "interview",
  "rejected",
  "hired",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "reviewed",
  "dismissed",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified", // документ не подано, ліміт 1 вакансія
  "pending", // подано, чекає на перевірку адміном
  "verified",
  "rejected",
]);

export const employerTypeEnum = pgEnum("employer_type", [
  "commercial", // комерційна юрособа: виробництво, будівництво, торгівля тощо
  "noncommercial", // некомерційна/бюджетна юрособа: держоргани, освіта, медицина, бібліотеки
  "military_security", // ЗСУ, МВС, ДСНС та інші органи сектору безпеки
  "fop", // ФОП — верифікується по ІПН/РНОКПП, а не ЄДРПОУ
]);

// Рівень СТО — лише для category="auto_service". Взаємовиключні (одна СТО
// не буває одночасно дилерським центром і приватним гаражем), тому enum з
// одним значенням, а не набір чекбоксів. Впливає на очікування кандидата
// (сертифікація, вік/бренд авто, вимоги), тому показується бейджем на
// вакансії й дає окремий фільтр на сторінці пошуку саме в цій категорії.
export const serviceCenterTierEnum = pgEnum("service_center_tier", [
  "dealer", // офіційний дилерський сервісний центр (один бренд, високі вимоги, сертифікація)
  "network", // мережева незалежна мультибрендова СТО (іномарки будь-якого віку, сучасне обладнання)
  "private", // локальна приватна СТО (будь-які авто, без вимог до сертифікатів, лише досвід)
]);

// Тип флоту/район плавання — лише для category="maritime_transport". Та
// сама посада (капітан, моторист) на річковому буксирі, каботажному
// судні, океанському танкері чи круїзному лайнері — по суті різні
// вакансії з різними вимогами до сертифікатів (STCW) і досвіду, кандидат
// з одного сегмента зазвичай не шукає роботу в іншому. Взаємовиключні,
// тому enum з одним значенням.
export const fleetTypeEnum = pgEnum("fleet_type", [
  "river", // річковий флот: буксири, баржі, прогулянкові катери, річкові пасажирські судна
  "coastal_cabotage", // морське прибережне/каботажне плавання (обмежений район)
  "ocean_going", // морське судноплавство необмеженого району плавання: танкери, балкери, великі судна
  "cruise_passenger", // круїзні/пасажирські лайнери — окремий клас через специфіку пасажирського сервісу
]);

// ---------- Tables ----------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("candidate"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const candidateProfiles = pgTable("candidate_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  headline: varchar("headline", { length: 255 }),
  location: varchar("location", { length: 255 }),
  // Бажана сфера роботи. Nullable — кандидат може не вказувати; тоді
  // рекомендації йдуть по всіх категоріях (тільки за embedding-схожістю).
  preferredCategory: jobCategoryEnum("preferred_category"),
  // Підкатегорія (текст, не enum — набір значень залежить від категорії,
  // див. JOB_SUBCATEGORIES в lib/job-options.ts). Валідується на рівні API.
  preferredSubcategory: varchar("preferred_subcategory", { length: 50 }),
  experienceYears: integer("experience_years"),
  skills: jsonb("skills").$type<string[]>().default([]),
  resumeUrl: text("resume_url"),
  resumeText: text("resume_text"),
  // OpenAI text-embedding-3-small has 1536 dimensions
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const employerProfiles = pgTable("employer_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // Юридична назва — та, що подається на верифікацію й звіряється з
  // ЄДРПОУ (наприклад, "ФОП Петренко Олена Вікторівна").
  companyName: varchar("company_name", { length: 255 }).notNull(),
  // Публічна назва/бренд — те, що бачать кандидати (наприклад, "Kava
  // Milano", якщо ФОП працює під франшизою). Не перевіряється, суто
  // маркетингове поле для довіри. Fallback на companyName, якщо не задано.
  displayName: varchar("display_name", { length: 255 }),
  companyDescription: text("company_description"),
  website: varchar("website", { length: 255 }),
  location: varchar("location", { length: 255 }),
  phone: varchar("phone", { length: 30 }),
  // Телефон видно кандидатам на сторінці вакансії, тільки якщо employer сам
  // це дозволив — за замовчуванням прихований.
  phoneVisible: boolean("phone_visible").notNull().default(false),
  // ЄДРПОУ (юрособи) або ІПН/РНОКПП (ФОП). Необов'язкове поле — без
  // нього employer все одно може публікувати вакансії, просто без бейджа
  // "Перевірено" (див. verificationStatus).
  edrpou: varchar("edrpou", { length: 20 }),
  // Вид діяльності (КВЕД), як його заявляє сам роботодавець — коротко,
  // своїми словами (наприклад, "Фотозйомка, створення відеоконтенту").
  // Використовується для перехресної перевірки при найм на вразливі ролі
  // в шоу-бізнесі/медіа (модель/акторка/танцівниця тощо): якщо ФОП з
  // видом діяльності "роздрібна торгівля" раптом наймає акторку — це
  // підозра на прикриття для вербування, і вакансія йде на ручну
  // модерацію замість автопублікації (див. checkBusinessActivityMismatch
  // в trust-gate.ts). Адмін звіряє це поле з реальним КВЕД у реєстрі під
  // час верифікації ЄДРПОУ/ІПН — саме тому редагування цього поля так
  // само скидає verificationStatus у "pending", як і зміна edrpou (інакше
  // вже верифікований ФОП міг би вписати сюди що завгодно заднім числом і
  // обійти перевірку).
  businessActivity: varchar("business_activity", { length: 255 }),
  // Номер ліцензії Мінекономіки на посередництво у працевлаштуванні за
  // кордоном — обов'язкове для роботодавців, що публікують вакансії на
  // судна під іноземним прапором (jobs.isForeignVesselCrewing=true) в
  // категорії "Морський та річковий транспорт". Легальний крюїнг в
  // Україні вимагає саме такої ліцензії; без неї посередництво у
  // працевлаштуванні моряків за кордоном незаконне. Самодекларується
  // роботодавцем, адмін звіряє під час верифікації (той самий принцип,
  // що й businessActivity вище) — тому редагування поля так само скидає
  // verificationStatus у "pending".
  foreignEmploymentLicenseNumber: varchar("foreign_employment_license_number", {
    length: 100,
  }),
  // Тип роботодавця — визначає, який документ звіряти і чи платна публікація
  // (див. isFreeTier). Nullable — employer вказує при подачі на верифікацію.
  employerType: employerTypeEnum("employer_type"),
  verificationStatus: verificationStatusEnum("verification_status")
    .notNull()
    .default("unverified"),
  // Коментар адміна — причина відмови у верифікації або службова нотатка.
  verificationNote: text("verification_note"),
  // Заготовка під майбутній біллінг: бюджетні/некомерційні організації та
  // сектор безпеки публікують безкоштовно. Білінгу в проекті ще немає —
  // зараз усі публікують безкоштовно незалежно від цього прапорця, поле
  // просто фіксує намір на майбутнє.
  isFreeTier: boolean("is_free_tier").notNull().default(false),
  // Бан адміном. При бані всі активні вакансії employer'а автоматично
  // закриваються, публікація нових блокується. Не блокує сам логін —
  // employer бачить банер з причиною на своєму дашборді.
  banned: boolean("banned").notNull().default(false),
  bannedAt: timestamp("banned_at"),
  banReason: text("ban_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  employerId: uuid("employer_id")
    .notNull()
    .references(() => employerProfiles.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  location: varchar("location", { length: 255 }),
  category: jobCategoryEnum("category").notNull().default("other"),
  subcategory: varchar("subcategory", { length: 50 }),
  // Лише для category="auto_service" — див. коментар біля
  // serviceCenterTierEnum. null для всіх інших категорій і для СТО, які
  // не вказали рівень (необов'язкове поле).
  serviceCenterTier: serviceCenterTierEnum("service_center_tier"),
  // Лише для category="maritime_transport" — див. коментар біля
  // fleetTypeEnum. null для всіх інших категорій і для суден, що не
  // вказали тип флоту (необов'язкове поле).
  fleetType: fleetTypeEnum("fleet_type"),
  // Найм на судно під іноземним прапором (крюїнг за кордон) — окрема
  // юридична вимога: роботодавець має бути ліцензованою крюїнговою
  // агенцією (див. employerProfiles.foreignEmploymentLicenseNumber).
  // Стосується будь-якої підкатегорії maritime_transport, не лише
  // палубної команди.
  isForeignVesselCrewing: boolean("is_foreign_vessel_crewing")
    .notNull()
    .default(false),
  // Додаткові категорії, в яких ця вакансія теж має показуватись (окрім
  // основної category) — наприклад, "кур'єр зі своїм авто" логічно
  // цікавить і тих, хто шукає в "Логістика", і тих, хто в "Водії кат.
  // A/B". Тільки на рівні категорії (без підкатегорій) — навмисно просте
  // рішення, щоб не ускладнювати jsonb-запити.
  crossListedCategories: jsonb("cross_listed_categories")
    .$type<string[]>()
    .default([]),
  employmentType: employmentTypeEnum("employment_type").notNull(),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  skillsRequired: jsonb("skills_required").$type<string[]>().default([]),
  status: jobStatusEnum("status").notNull().default("draft"),
  // Причина, з якою AI-модерація відправила вакансію на pending_review
  // (наприклад, "схоже на МЛМ"). null — модерацію пройдено або ще не було.
  moderationReason: text("moderation_reason"),
  // Категорія проблеми — окрема від reason, щоб адмінка могла показувати
  // exploitation_risk (можлива торгівля людьми/секс-експлуатація) з
  // підвищеною терміновістю/іншим візуальним стилем, а не як звичайний спам.
  moderationCategory: moderationCategoryEnum("moderation_category"),
  // true, якщо адмін вручну відхилив вакансію на /admin/jobs (кнопка
  // "Відхилити"). Окремо від status='closed', бо closed буває й з інших
  // причин (сам employer закрив, прийнята скарга). Використовується для
  // підрахунку "кандидатів на бан" — 3+ відхилених вакансій.
  rejectedByAdmin: boolean("rejected_by_admin").notNull().default(false),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("applied"),
    coverLetter: text("cover_letter"),
    matchScore: real("match_score"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Один кандидат — одна заявка на конкретну вакансію
    unique("applications_job_candidate_unique").on(
      table.jobId,
      table.candidateId,
    ),
  ],
);

// Антифрод: скарги користувачів — на вакансію АБО на роботодавця загалом
// (наприклад, коли employer видалив конкретну вакансію після співбесіди —
// скарга на роботодавця виживає незалежно від долі вакансії).
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Обов'язковий — кожна скарга принципово про конкретного роботодавця,
    // навіть якщо подана через сторінку конкретної вакансії.
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employerProfiles.id, { onDelete: "cascade" }),
    // Опційний — SET NULL (не CASCADE!), щоб видалення вакансії employer'ом
    // не знищувало доказ. jobTitleSnapshot зберігає контекст, навіть якщо
    // сама вакансія згодом видалена.
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    jobTitleSnapshot: varchar("job_title_snapshot", { length: 255 }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Дедуп лише для скарг на конкретну вакансію (jobId not null) —
    // одна скарга від юзера на одну вакансію. Для загальних скарг на
    // роботодавця (jobId null) дедуп перевіряється на рівні коду.
    unique("reports_job_reporter_unique").on(table.jobId, table.reporterId),
  ],
);

// ---------- Relations ----------

export const usersRelations = relations(users, ({ one }) => ({
  candidateProfile: one(candidateProfiles, {
    fields: [users.id],
    references: [candidateProfiles.userId],
  }),
  employerProfile: one(employerProfiles, {
    fields: [users.id],
    references: [employerProfiles.userId],
  }),
}));

export const candidateProfilesRelations = relations(
  candidateProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [candidateProfiles.userId],
      references: [users.id],
    }),
    applications: many(applications),
  }),
);

export const employerProfilesRelations = relations(
  employerProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [employerProfiles.userId],
      references: [users.id],
    }),
    jobs: many(jobs),
  }),
);

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  employer: one(employerProfiles, {
    fields: [jobs.employerId],
    references: [employerProfiles.id],
  }),
  applications: many(applications),
  reports: many(reports),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  job: one(jobs, {
    fields: [applications.jobId],
    references: [jobs.id],
  }),
  candidate: one(candidateProfiles, {
    fields: [applications.candidateId],
    references: [candidateProfiles.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  job: one(jobs, {
    fields: [reports.jobId],
    references: [jobs.id],
  }),
  employer: one(employerProfiles, {
    fields: [reports.employerId],
    references: [employerProfiles.id],
  }),
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
  }),
}));
