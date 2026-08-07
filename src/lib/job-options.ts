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
  { value: "government", label: "Державні органи та служби" },
  { value: "accounting", label: "Бухгалтерія та фінанси" },
  { value: "education", label: "Освіта" },
  { value: "military", label: "Військові професії" },
  { value: "other", label: "Інше" },
] as const;

export const JOB_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(JOB_CATEGORIES.map((c) => [c.value, c.label]));
