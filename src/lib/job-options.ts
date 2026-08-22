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
  { value: "drivers", label: "Водії кат. A/B (особисті, таксі, кур'єри)" },
  { value: "logistics", label: "Логістика та склад" },
  { value: "agriculture", label: "Сільське господарство" },
  { value: "government", label: "Державні органи та служби" },
  { value: "accounting", label: "Бухгалтерія та фінанси" },
  { value: "education", label: "Освіта та виховання" },
  { value: "military", label: "Військові професії" },
  { value: "medical", label: "Медичні працівники" },
  { value: "veterinary_medicine", label: "Ветеринарна медицина" },
  { value: "hospitality", label: "Готельно-ресторанний сектор" },
  { value: "catering", label: "Громадське та корпоративне харчування" },
  { value: "auto_service", label: "Автосервіс / СТО" },
  { value: "maintenance", label: "Технічне обслуговування" },
  { value: "passenger_transport", label: "Пасажирський транспорт" },
  { value: "railway_transport", label: "Залізничний транспорт" },
  { value: "maritime_transport", label: "Морський та річковий транспорт" },
  { value: "culture", label: "Культура та мистецтво" },
  { value: "science", label: "Наука" },
  { value: "facilities_management", label: "Адміністративно-господарський персонал" },
  { value: "show_business", label: "Шоу-бізнес" },
  { value: "media", label: "Медіа" },
  { value: "service_staff", label: "Обслуговий персонал" },
  { value: "security", label: "Охорона" },
  { value: "utilities", label: "ЖКГ та благоустрій" },
  { value: "legal", label: "Юридичні працівники" },
  { value: "management_marketing", label: "Менеджмент та маркетинг" },
  { value: "other", label: "Інше" },
] as const;

export const JOB_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(JOB_CATEGORIES.map((c) => [c.value, c.label]));

// Підкатегорії — тільки там, де категорія реально неоднорідна (наприклад,
// "виробництво" охоплює і токаря, і інженера-технолога, а "IT" — і
// фронтенд-розробника, і сисадміна — геть різні профілі й запити). Не для
// всіх категорій, тільки де це дає реальну точність матчингу. Текстове
// поле, а не enum — легше розширювати без міграцій.
export const JOB_SUBCATEGORIES: Record<
  string,
  { value: string; label: string }[]
> = {
  construction: [
    {
      value: "construction_itp",
      label: "ІТП (інженери, архітектори, виконроби)",
    },
    {
      value: "construction_workers",
      label:
        "Будівельні робітники (муляри, маляри, штукатури, монтажники, стропальники, кранівники, екскаваторники, бульдозеристи тощо)",
    },
  ],
  logistics: [
    { value: "long_haul_drivers", label: "Водії-дальнобійники" },
    {
      value: "truck_drivers_forwarders",
      label: "Водії вантажівок та експедитори",
    },
    { value: "loaders", label: "Вантажники" },
    {
      value: "warehouse_admin",
      label: "Адміністративний персонал складу (комірники та ін.)",
    },
    { value: "logistics_couriers", label: "Кур'єри (кур'єрська доставка)" },
  ],
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
    {
      value: "quality_control",
      label: "Контроль якості, ВТК та лабораторія",
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
  education: [
    { value: "higher_education", label: "Вищі навчальні заклади" },
    {
      value: "vocational_education",
      label: "Середнє професійне навчання (коледжі та ін.)",
    },
    { value: "school_education", label: "Шкільна освіта" },
    {
      value: "preschool_education",
      label: "Дошкільне виховання та няні",
    },
  ],
  veterinary_medicine: [
    {
      value: "state_veterinary_service",
      label:
        "Державна ветеринарна служба (районна служба, виклики до дрібних господарів, реєстрація/вакцинація худоби, лабораторний контроль на ринках)",
    },
    {
      value: "pet_veterinary",
      label: "Ветеринари pet-сектору (клініки для котів, собак, птахів тощо)",
    },
  ],
  trade: [
    { value: "sales_staff", label: "Продавці / касири" },
    {
      value: "trade_management",
      label: "Адміністратори / менеджери магазину",
    },
  ],
  drivers: [
    { value: "personal_driver", label: "Особистий водій" },
    { value: "taxi_driver", label: "Таксист" },
    { value: "courier_driver", label: "Кур'єр (авто/мото)" },
  ],
  government: [
    {
      value: "civil_service",
      label:
        "Державна служба та самоврядування (спеціаліст міністерства, державний експерт, секретар селищної ради, юрист виконкому)",
    },
    {
      value: "law_enforcement",
      label:
        "Правоохоронні органи та спеціальні служби (суддя, прокурор, слідчий, оперуповноважений, інспектор патрульної поліції, детектив НАБУ, інспектор ДСНС)",
    },
  ],
  agriculture: [
    {
      value: "agronomy_crop_production",
      label: "Агрономія та рослинництво (агрономи, селекціонери, технологи)",
    },
    {
      value: "agricultural_machinery",
      label: "Агротехніка та механізація (трактористи, комбайнери)",
    },
    {
      value: "livestock_veterinary",
      label:
        "Тваринництво, птахівництво, ветеринарія (ветлікарі, зоотехніки, технологи птахофабрик, оператори доїння, наглядачі за тваринами)",
    },
    {
      value: "seasonal_harvest",
      label:
        "Сезонні роботи та збір врожаю (збирачі ягід/фруктів/овочів, польові різноробочі, сортувальники, пакувальники)",
    },
    {
      value: "landscaping_gardening",
      label:
        "Садівництво, ландшафт та благоустрій (садівник, ландшафтний дизайнер, озеленувач, доглядальник за газонами)",
    },
    {
      value: "forestry_fishery",
      label: "Лісове та рибне господарство (єгер, пилорамник, вальник лісу, рибовод)",
    },
  ],
  security: [
    { value: "object_security", label: "Охорона об'єктів" },
    { value: "personal_security", label: "Охорона осіб (тілоохоронці)" },
    {
      value: "security_systems_installation",
      label: "Монтаж та налаштування охоронних систем",
    },
  ],
  it: [
    {
      value: "web_mobile_dev",
      label:
        "Веб та мобільна розробка (фронтенд, бекенд, фулстек, мобільна, DevOps, дизайн сайтів/додатків)",
    },
    {
      value: "desktop_game_dev",
      label:
        "Розробка десктоп-програм та ігор (C/C++/C#, геймдизайн, 3D-графіка)",
    },
    {
      value: "embedded_programming",
      label:
        "Технологічне та низькорівневе програмування (верстати, роботи, мікроконтролери, C/C++/Assembler)",
    },
    {
      value: "it_infrastructure",
      label: "Технічне обслуговування, мережі та сисадміністрування",
    },
    {
      value: "ai_data_analytics",
      label: "Штучний інтелект, дані та аналітика",
    },
    { value: "cybersecurity", label: "Кібербезпека та захист даних" },
    { value: "pm_qa", label: "Управління проектами та QA" },
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
