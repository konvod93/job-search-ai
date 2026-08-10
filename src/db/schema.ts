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
  "agriculture",
  "juridical",
  "healthcare",
  "hospitality",
  "logistics",
  "marketing",
  "media",
  "science",
  "show-business",
  "culture",
  "government",
  "accounting",
  "education",
  "military",
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
  companyName: varchar("company_name", { length: 255 }).notNull(),
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

// Антифрод: скарги користувачів на вакансії (МЛМ, шахрайство, спам).
// Логіка розгляду скарг (адмін-панель) — окремий крок пізніше.
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("reports_job_reporter_unique").on(table.jobId, table.reporterId)],
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
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
  }),
}));
