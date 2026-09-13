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
  { value: "medical", label: "Медицина та охорона здоров'я" },
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
  military: [
    {
      value: "combat_command",
      label: "Командні бойові офіцерські посади (комвзводу, комроти та ін.)",
    },
    {
      value: "staff_planning",
      label:
        "Штабні офіцерські посади та планування (начальники штабів, оперативні чергові КСП)",
    },
    {
      value: "technical_logistics_officers",
      label:
        "Технічні, господарські та адміністративні офіцери (зампотех, начпрод, начфін, начальник стройової частини)",
    },
    {
      value: "morale_psychological",
      label:
        "Морально-психологічне забезпечення (офіцери МПЗ, психологи в/ч)",
    },
    {
      value: "military_medicine_officers",
      label: "Військова медицина (начмеди, бойові медики)",
    },
    {
      value: "sergeant_command",
      label:
        "Сержантські командні посади (командир відділення, головний сержант роти)",
    },
    {
      value: "combat_soldier",
      label:
        "Бойові солдатські посади (кулеметник, гранатометник, оператор БПЛА, бойовий водій)",
    },
    {
      value: "technical_soldier",
      label:
        "Технічні та господарські солдатські посади (військовий кухар, слюсар ремвзводу, тиловий водій)",
    },
    {
      value: "admin_soldier",
      label: "Адміністративні солдатські посади (писар, діловод)",
    },
    {
      value: "logistics_supply",
      label:
        "Тилове забезпечення, логістика та постачання (начальник тилового складу, завідувач сховища, водій логістичного батальйону)",
    },
    {
      value: "rear_medical_vlk",
      label:
        "Військова медицина тилових шпиталів та ВЛК (лікар/фельдшер/медсестра госпіталю, голова/член ВЛК, реабілітолог тилового медцентру)",
    },
    {
      value: "training_tck",
      label:
        "Навчальні центри, полігони та ТЦК і СП (інструктор навчального центру, інструктор з тактичної підготовки, оператор ТЦК та СП, діловод ТЦК)",
    },
  ],
  accounting: [
    {
      value: "management_finance_audit",
      label:
        "Управлінські фінанси та аудит (фінансовий директор, головний бухгалтер, внутрішній/зовнішній аудитор, фінансовий аналітик, керівник КРУ)",
    },
    {
      value: "bookkeeping_reporting",
      label:
        "Бухгалтерський облік та звітність (первинна документація, зарплата, облік ТМЦ, бухгалтер-єдинник)",
    },
    {
      value: "banking_insurance",
      label:
        "Банківська справа та страхування (кредитний експерт, ризик-менеджер банку, страховий агент, операціоніст банку)",
    },
    {
      value: "cash_operations",
      label:
        "Каса, інкасація та лінійні розрахунки (лише ліцензовані фінустанови)",
    },
    {
      value: "economics_planning",
      label:
        "Економіка, планування та ціноутворення (економіст з планування, кошторисник, спеціаліст з ціноутворення)",
    },
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
    {
      value: "doctors",
      label:
        "Лікарі (терапевт, педіатр, кардіолог, хірург, стоматолог, лікар-лаборант, госпітальний епідеміолог)",
    },
    {
      value: "mid_junior_medical",
      label:
        "Середній та молодший персонал (фельдшери, акушери, медсестри/медбрати, лаборанти, санітари)",
    },
    {
      value: "pharmacy",
      label:
        "Фармацевтика та аптечна справа (завідувач аптеки, провізор, фармацевт — лише з ліцензією)",
    },
    {
      value: "sanitary_epidemiological_service",
      label:
        "Державна санітарно-епідеміологічна служба та Держпродспоживслужба",
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
      value: "preschool_institutions",
      label: "Дошкільні заклади (садочки)",
    },
    {
      value: "nannies",
      label: "Няні (лише через агенції — прямий найм фізособою заборонено)",
    },
    {
      value: "governess",
      label:
        "Гувернери / домашні педагоги (підготовка до вступу в елітні заклади — лише через агенції)",
    },
    {
      value: "tutors",
      label:
        "Репетитори (підвищення успішності, підготовка до екзаменів та вступу — лише через агенції)",
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
  hospitality: [
    {
      value: "horeca_top_management",
      label:
        "Топ-менеджмент та управління (директор / генеральний менеджер готелю, керуючий рестораном, директор ресторану, операційний директор мережі, керівник напряму HoReCa, арт-директор / івент-менеджер)",
    },
    {
      value: "horeca_kitchen_production",
      label:
        "Кухня та виробництво (шеф-кухар, су-шеф, кухар, шеф-кондитер / кондитер, піцайоло / сушист, завгосп / технолог, кухонний працівник / мийник посуду)",
    },
    {
      value: "horeca_hall_service",
      label:
        "Ресторанний зал та обслуговування (адміністратор залу / метрдотель / хостес, офіціант / старший офіціант / раннер, сомельє, банкетний менеджер)",
    },
    {
      value: "horeca_bar_coffee",
      label:
        "Бар та кав'ярні (шеф-бартендер / старший бармен, бармен, бариста, помічник бармена / барбек)",
    },
    {
      value: "horeca_hotel_reception",
      label:
        "Готельний сервіс та ресепшн (портьє / адміністратор рецепції, нічний аудитор, консьєрж, швейцар / белбой, оператор бронювання)",
    },
    {
      value: "horeca_housekeeping",
      label:
        "Господарська служба готелю (керівник господарської служби, старша покоївка / супервайзер, покоївка, прибиральник / праля / комірник, майстер з ремонту / технік готелю)",
    },
    {
      value: "horeca_spa_wellness_management",
      label:
        "Керування SPA та супровідний персонал (керуючий SPA-комплексом, адміністратор SPA / фітнес-зони, рятувальник / інструктор басейну)",
    },
    {
      value: "horeca_animators_masseurs",
      label:
        "Аніматори та масажисти (аніматор дитячий / дорослий, масажист / естетист — лише через агенцію/верифіковану юрособу)",
    },
  ],
  catering: [
    {
      value: "catering_education",
      label:
        "Харчування в навчальних закладах (шеф-кухар / завідувач виробництва їдальні, кухар дитячого харчування, помічник кухаря / кухонний робітник, комірник / калькулятор обліку продуктів і калорійності, буфетник / продавець шкільного буфету)",
    },
    {
      value: "catering_medical",
      label:
        "Харчування у медичних та лікувальних закладах (шеф-кухар харчоблоку, дієт-сестра / медична сестра дієтичного харчування, кухар-дієтолог, кухар гарячого / холодного цеху, роздавальник / офіціант з рознесення їжі по палатах)",
    },
    {
      value: "catering_industrial",
      label:
        "Промисловий (індустріальний) кейтеринг (керуючий об'єктом харчування / заввиробництва, старший кухар зміни, кухар масового приготування / кухар-універсал, м'ясник / обвалювальник м'яса, касир / оператор лінії видачі, вантажник-підсобник / мийник котлів)",
    },
    {
      value: "catering_corporate",
      label:
        "Корпоративне харчування (шеф-кухар корпоративного кафе, су-шеф / старший кухар, кухар лінії видачі / кухар на відкриту кухню, бариста / буфетник корпоративного кава-поінту, адміністратор / касир їдальні)",
    },
    {
      value: "catering_offsite_factory_kitchen",
      label:
        "Виїзне обслуговування та фабрики-кухні (бренд-шеф кейтерингової компанії, менеджер з продажу кейтерингових послуг / івент-менеджер, кухар-заготівельник / кухар напівфабрикатів, координатор виїзного обслуговування, офіціант кейтерингу, комплектувальник обідів / пакувальник)",
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
  service_staff: [
    {
      value: "private_household_staff",
      label:
        "Приватний домашній персонал (хатня робітниця, наглядач за садибою, приватний садівник — лише агенції)",
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

// Пари category:subcategory, де публікація вимагає верифікованої ЮРОСОБИ
// (навіть верифікований ФОП недостатньо). Три різні причини потрапляння
// сюди:
// 1) кінцевий "роботодавець" по суті приватна особа, а не структура —
//    найм фізособою напряму реальний ризик для обох сторін (кандидат "з
//    вулиці" без перевірки документів/мед-психогляду може бути
//    небезпечною людиною; довірити дитину/дім/безпеку незнайомцю без
//    посередника — ризик іншого роду);
// 2) робота вимагає ліцензії/регуляторного статусу, якого в одноосібного
//    ФОП фізично бути не може (банківська каса, обмін валют, ломбард —
//    ліцензія НБУ/фінустанови);
// 3) категорія вакансії — типове прикриття для вербування в трафікінг/
//    секс-індустрію під легальним на вигляд оголошенням (аніматор/
//    масажист "у готель за кордоном" — класична схема). Верифікована
//    юрособа (готель, SPA-мережа) значно важче підробити, ніж ФОП чи
//    анонімний акаунт, тож саме тут піднімаємо поріг.
// Хто не хоче йти через агенцію/ліцензовану установу — може шукати на
// інших майданчиках на свій ризик, тут це свідомо не підтримується.
const AGENCY_ONLY_PAIRS = new Set([
  "education:nannies",
  "education:governess",
  "education:tutors",
  "drivers:personal_driver",
  "security:personal_security",
  "service_staff:private_household_staff",
  "accounting:cash_operations",
  "hospitality:horeca_animators_masseurs",
]);

export function requiresAgencyVerification(
  category: string,
  subcategory: string | null | undefined,
): boolean {
  return !!subcategory && AGENCY_ONLY_PAIRS.has(`${category}:${subcategory}`);
}

// Пари category:subcategory, де достатньо звичайної верифікації (ЄДРПОУ
// або ІПН/РНОКПП) — на відміну від AGENCY_ONLY_PAIRS, тут ФОП дозволений,
// якщо верифікований. Приклад: аптека цілком легально може бути ФОП з
// ліцензією на фармацевтичну діяльність — тут ризик не "приватна особа
// замість структури", а просто "потрібна підтверджена ліцензована
// діяльність, а не анонім".
const VERIFIED_ONLY_PAIRS = new Set(["medical:pharmacy"]);

export function requiresVerificationOnly(
  category: string,
  subcategory: string | null | undefined,
): boolean {
  return !!subcategory && VERIFIED_ONLY_PAIRS.has(`${category}:${subcategory}`);
}

// Пари category:subcategory, які по суті є державними органами/службами,
// хоча самі живуть не в категорії "government" — санепідслужба та
// Держпродспоживслужба зазначені в категорії "медицина" (бо кандидати
// шукають їх поруч із мед. вакансіями), але як роботодавець це той самий
// клас ризику, що й будь-яка держструктура: анонім/ФОП не повинен
// публікувати вакансію нібито від імені держоргану. Гейт для них — той
// самий, що і на всю категорію "government" (лише верифікована юрособа).
const GOVERNMENT_AUTHORITY_PAIRS = new Set([
  "medical:sanitary_epidemiological_service",
]);

export function isGovernmentAuthorityRole(
  category: string,
  subcategory: string | null | undefined,
): boolean {
  return (
    category === "government" ||
    (!!subcategory &&
      GOVERNMENT_AUTHORITY_PAIRS.has(`${category}:${subcategory}`))
  );
}
