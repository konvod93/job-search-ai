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
  { value: "logistics", label: "Логістика та склад" },
  { value: "agriculture", label: "Сільське господарство" },
  { value: "government", label: "Державні органи та служби" },
  { value: "accounting", label: "Бухгалтерія та фінанси" },
  { value: "education", label: "Освіта" },
  { value: "military", label: "Військові професії" },
  { value: "medical", label: "Медичні працівники" },
  { value: "hospitality", label: "Готельно-ресторанний сектор" },
  { value: "culture", label: "Культура та мистецтво" },
  { value: "science", label: "Наука" },
  { value: "facilities_management", label: "Адміністративно-господарський персонал" },
  { value: "show_business", label: "Шоу-бізнес" },
  { value: "media", label: "Медіа" },
  { value: "service_staff", label: "Обслуговий персонал" },
  { value: "utilities", label: "ЖКГ та благоустрій" },
  { value: "legal", label: "Юридичні працівники" },
  { value: "management_marketing", label: "Менеджмент та маркетинг" },
  { value: "other", label: "Інше" },
] as const;

export const JOB_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(JOB_CATEGORIES.map((c) => [c.value, c.label]));

// Підкатегорії — тільки там, де категорія реально неоднорідна (наприклад,
// "виробництво" охоплює і токаря, і інженера-технолога — геть різні
// профілі). Не для всіх 23 категорій, тільки де це дає реальну точність
// матчингу. Текстове поле, а не enum — легше розширювати без міграцій.
export const JOB_SUBCATEGORIES: Record<
  string,
  { value: string; label: string }[]
> = {
  manufacturing: [
    {
      value: "production_workers",
      label: "Робітничі професії (токар, фрезерувальник, зварник тощо)",
    },
    {
      value: "engineering_technical",
      label:
        "Інженерно-технічний персонал (майстри, інженери, технологи, конструктори)",
    },
  ],
  medical: [
    { value: "doctors", label: "Лікарі" },
    {
      value: "mid_junior_medical",
      label:
        "Середній та молодший медперсонал (фельдшери, медсестри/медбрати, акушери, санітари)",
    },
  ],
};

export function getSubcategoriesFor(
  category: string,
): { value: string; label: string }[] {
  return JOB_SUBCATEGORIES[category] ?? [];
}

export function subcategoryLabel(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): string | null {
  if (!category || !subcategory) return null;
  return (
    JOB_SUBCATEGORIES[category]?.find((s) => s.value === subcategory)
      ?.label ?? null
  );
}

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
