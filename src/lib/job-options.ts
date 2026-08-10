export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Повна зайнятість" },
  { value: "part_time", label: "Часткова зайнятість" },
  { value: "contract", label: "Контракт" },
  { value: "internship", label: "Стажування" },
  { value: "remote", label: "Віддалено" },
] as const;

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(EMPLOYMENT_TYPES.map((t) => [t.value, t.label]));

export const JOB_CATEGORIES = [
  { value: "it", label: "IT" },
  { value: "construction", label: "Будівництво та ремонт" },
  { value: "manufacturing", label: "Виробництво" },
  { value: "trade", label: "Торгівля" },
  { value: "drivers", label: "Водії" },
  { value: "agriculture", label: "Сільське господарство" },
  { value: "juridical", label: "Юридичні професії" },
  { value: "healthcare", label: "Медичні працівники" },
  { value: "government", label: "Державні органи та служби" },
  { value: "accounting", label: "Бухгалтерія та фінанси" },
  { value: "education", label: "Освіта" },
  { value: "military", label: "Військові професії" },
  { value: "other", label: "Інше" },
] as const;

export const JOB_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(JOB_CATEGORIES.map((c) => [c.value, c.label]));

export const EMPLOYER_TYPES = [
  { value: "commercial", label: "Комерційна юрособа" },
  { value: "noncommercial", label: "Некомерційна / бюджетна установа" },
  { value: "military_security", label: "ЗСУ / МВС / ДСНС" },
  { value: "fop", label: "ФОП" },
] as const;

export const EMPLOYER_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(EMPLOYER_TYPES.map((t) => [t.value, t.label]));

// Некомерційні/бюджетні організації та сектор безпеки — безкоштовна
// публікація (заготовка під майбутній біллінг, зараз усе безкоштовне).
export const FREE_TIER_EMPLOYER_TYPES = new Set([
  "noncommercial",
  "military_security",
]);

// Юрособи звіряються по ЄДРПОУ, ФОП — по ІПН/РНОКПП.
export function registrationNumberLabel(
  employerType: string | null | undefined,
): string {
  return employerType === "fop" ? "ІПН / РНОКПП" : "ЄДРПОУ";
}
