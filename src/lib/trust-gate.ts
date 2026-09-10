import { getAnthropicClient } from "./anthropic";

export type TrustGateResult = {
  hasExternalContact: boolean;
  externalContactPhrase: string | null;
  isWomenEntertainmentRole: boolean;
  entertainmentReason: string | null;
  isSecurityDriverRole: boolean;
  securityDriverReason: string | null;
  isSuspiciousCourierRole: boolean;
  courierReason: string | null;
};

const TOOL = {
  name: "submit_trust_gate_result",
  description:
    "Повертає результат перевірки вакансії на чотири незалежні ознаки довіри",
  input_schema: {
    type: "object" as const,
    properties: {
      has_external_contact: {
        type: "boolean" as const,
        description:
          "true, якщо текст намагається спрямувати кандидата на зв'язок поза платформою",
      },
      external_contact_phrase: {
        type: "string" as const,
        description:
          "Конкретна фраза/згадка з тексту, яка це підтверджує. Порожній рядок, якщо has_external_contact=false.",
      },
      is_women_entertainment_role: {
        type: "boolean" as const,
        description:
          "true, якщо вакансія шукає саме жінок на роль моделі/танцівниці/співачки/акторки чи подібну роль у шоу-бізнесі",
      },
      entertainment_reason: {
        type: "string" as const,
        description:
          "Коротке пояснення (до 15 слів), яку саме роль шукають. Порожній рядок, якщо is_women_entertainment_role=false.",
      },
      is_security_driver_role: {
        type: "boolean" as const,
        description:
          "true, якщо вакансія 'особистого водія' насправді вимагає навичок охорони/тілоохоронця",
      },
      security_driver_reason: {
        type: "string" as const,
        description:
          "Коротке пояснення (до 15 слів), яка саме ознака охорони знайдена. Порожній рядок, якщо is_security_driver_role=false.",
      },
      is_suspicious_courier_role: {
        type: "boolean" as const,
        description:
          "true, якщо кур'єрська вакансія має ознаки вербування в перевезення заборонених речовин",
      },
      courier_reason: {
        type: "string" as const,
        description:
          "Коротке пояснення (до 15 слів), яка саме ознака знайдена. Порожній рядок, якщо is_suspicious_courier_role=false.",
      },
    },
    required: [
      "has_external_contact",
      "external_contact_phrase",
      "is_women_entertainment_role",
      "entertainment_reason",
      "is_security_driver_role",
      "security_driver_reason",
      "is_suspicious_courier_role",
      "courier_reason",
    ],
  },
};

const SYSTEM_PROMPT = `Ти аналізуєш текст вакансії на чотири незалежні ознаки. Усі застосовуються тільки до неверифікованих/малодовірених роботодавців — це додатковий бар'єр, поки особу роботодавця не підтверджено вручну.

1. **has_external_contact** — чи оголошення спрямовує кандидата на зв'язок ПОЗА платформою (Telegram, Viber, WhatsApp, Instagram директ, Discord тощо), включно із замаскованими варіантами:
   - заміна "@" словом ("телеграм песик username", "тг собака username", "at username")
   - розбиття юзернейму пробілами/крапками/тире
   - написання назви месенджера з помилками чи через символи, щоб обійти фільтри
   - фрази на кшталт "докладніше в...", "пишіть/дзвоніть в...", "весь список у..." з посиланням на сторонній канал
   Контактний телефон компанії в окремому полі профілю — це нормально, не стосується цієї перевірки. Оцінюєш тільки сам текст вакансії (title+description).

2. **is_women_entertainment_role** — чи вакансія шукає саме ЖІНОК на роль моделі, танцівниці, співачки, акторки чи подібну роль у шоу-бізнесі/індустрії розваг/розважальних закладах. Позначай незалежно від того, виглядає пропозиція легітимною чи ні — сама категорія ролі вимагає додаткової верифікації роботодавця (навіть легітимний театр чи кіностудія повинні підтвердити реєстрацію перед публікацією такої вакансії, бо ця категорія оголошень часто використовується для вербування в секс-індустрію).

3. **is_security_driver_role** — чи вакансія "особистого водія" насправді описує роль тілоохоронця/охоронця під виглядом водія. Ознаки: вимога володіння зброєю чи вогнепальною зброєю, "силове"/екстремальне водіння, досвід служби в силових структурах (армія, поліція, спецпризначення, ЧВК), фізична підготовка/бойові мистецтва як вимога. Позначай незалежно від того, виглядає пропозиція легітимною чи ні — легітимна охоронна фірма теж повинна верифікуватись перед такою публікацією, бо цей патерн часто використовується для вербування в кримінальні угруповання під виглядом "водія". Звичайна вакансія особистого водія без цих ознак (просто керує авто) — це НЕ позначається.

4. **is_suspicious_courier_role** — чи кур'єрська вакансія має ознаки вербування в перевезення заборонених речовин (наркокур'єрство/"закладки") під виглядом звичайної доставки. Ознаки:
   - наголос на анонімності ("без співбесіди", "документи не потрібні", "не питаємо зайвого")
   - оплата готівкою за кожну доставку без офіційного оформлення/трудового договору
   - розпливчастий опис того, що саме доставляється ("невеликі пакунки", "конверти", без назви товару)
   - відсутність назви й реквізитів реальної компанії-роботодавця
   - обіцянка високого заробітку за просту доставку без пояснення джерела прибутковості
   Звичайна кур'єрська вакансія від впізнаваної компанії (пошта, ресторан, магазин, кур'єрська служба) з чіткими умовами — це НЕ позначається.`;

/**
 * Перевіряє вакансію на зовнішні контакти, "жіночі" ролі в шоу-бізнесі,
 * водіїв-охоронців і підозрілі кур'єрські вакансії — усі чотири перевірки
 * застосовуються лише до неверифікованих/ФОП роботодавців (викликається
 * умовно з роуту, а не завжди). null при збої AI — виклик коду вирішує, як
 * поводитись.
 */
export async function checkTrustGate(
  title: string,
  description: string,
): Promise<TrustGateResult | null> {
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        {
          role: "user",
          content: `Назва: ${title}\n\nОпис: ${description}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block) => block.type === "tool_use",
    );

    if (!toolUse || toolUse.type !== "tool_use") {
      return null;
    }

    const input = toolUse.input as {
      has_external_contact: boolean;
      external_contact_phrase: string;
      is_women_entertainment_role: boolean;
      entertainment_reason: string;
      is_security_driver_role: boolean;
      security_driver_reason: string;
      is_suspicious_courier_role: boolean;
      courier_reason: string;
    };

    return {
      hasExternalContact: input.has_external_contact,
      externalContactPhrase: input.has_external_contact
        ? input.external_contact_phrase
        : null,
      isWomenEntertainmentRole: input.is_women_entertainment_role,
      entertainmentReason: input.is_women_entertainment_role
        ? input.entertainment_reason
        : null,
      isSecurityDriverRole: input.is_security_driver_role,
      securityDriverReason: input.is_security_driver_role
        ? input.security_driver_reason
        : null,
      isSuspiciousCourierRole: input.is_suspicious_courier_role,
      courierReason: input.is_suspicious_courier_role
        ? input.courier_reason
        : null,
    };
  } catch (err) {
    console.error("[trust-gate] AI check failed:", err);
    return null;
  }
}

/**
 * Перевіряє, чи заявлений вид діяльності ФОП (те, що адмін звірив з КВЕД у
 * реєстрі при верифікації, див. businessActivity в employerProfiles)
 * правдоподібно узгоджується з "вразливою" роллю в шоу-бізнесі/медіа
 * (модель/акторка/танцівниця/співачка тощо). Легітимні випадки —
 * фотограф-фрилансер наймає модель для портфоліо, відеоблогер наймає
 * акторку, продюсер гурту наймає співачку — усі мають businessActivity,
 * що правдоподібно пояснює найм. Викликається лише коли:
 * - trustGate.isWomenEntertainmentRole === true, і
 * - роботодавець ФОП (для юрособ ця перевірка не потрібна — там достатньо
 *   самої верифікації юрособи, підробити реєстрацію компанії набагато
 *   важче, ніж вид діяльності ФОП).
 *
 * На відміну від checkTrustGate, тут навмисно НЕ "fail open": збій AI
 * трактується як "потрібна ручна перевірка" (null → виклик коду сам
 * вирішує показати pending_review), а відсутність businessActivity в
 * профілі теж не дає автопублікації. Категорія ризику (можлива торгівля
 * людьми) достатньо серйозна, щоб при невизначеності краще зайвий раз
 * потурбувати адміна, ніж пропустити підозрілу вакансію напряму в
 * публікацію.
 */
export type BusinessActivityMismatchResult = {
  isMismatch: boolean;
  reason: string | null;
};

const ACTIVITY_TOOL = {
  name: "submit_activity_match_result",
  description:
    "Оцінює, чи заявлений вид діяльності ФОП правдоподібно узгоджується з роллю, на яку він наймає людину",
  input_schema: {
    type: "object" as const,
    properties: {
      is_mismatch: {
        type: "boolean" as const,
        description:
          "true, якщо заявлений вид діяльності явно НЕ пов'язаний з наймом на цю роль (наприклад, 'роздрібна торгівля одягом' раптом наймає акторку)",
      },
      reason: {
        type: "string" as const,
        description:
          "Коротке пояснення (до 20 слів), чому це не в'яжеться. Порожній рядок, якщо is_mismatch=false.",
      },
    },
    required: ["is_mismatch", "reason"],
  },
};

// Суворіший промпт, ніж перша версія. Реальний інцидент: ФОП з видом
// діяльності "кав'ярня" опублікував вакансію "співачка" — AI визнав це
// НЕ мисметчем ("кав'ярні часто запрошують живих виконавців"), і
// вакансія пішла в публікацію без модерації. Це правдоподібне на
// перший погляд міркування, але кав'ярня — заклад громадського
// харчування (продаж їжі/напоїв), а НЕ виробництво чи організація
// медіа-/розважального контенту як основний бізнес. Той самий патерн
// ("співачка в кафе за кордоном") — реальна схема вербування, тож саме
// тут AI не повинен додумувати непрямі зв'язки на користь роботодавця.
const ACTIVITY_SYSTEM_PROMPT = `Ти оцінюєш, чи заявлений вид діяльності ФОП (те, чим він офіційно займається за реєстром) — САМ ПО СОБІ, як основний бізнес — прямо пояснює найм людини на цю конкретну "вразливу" роль (модель/акторка/танцівниця/співачка тощо).

is_mismatch=false — ТІЛЬКИ якщо основна діяльність ФОП сама по собі є виробництвом чи організацією медіа-/розважального контенту:
- Фотографія / Відеозйомка / Створення відеоконтенту / Блогінг → найм моделі для зйомки
- Кінопродакшн / Артист-агентство / Модельне агентство / Букінг-агентство → найм акторки/моделі
- Звукозапис / Музичний продакшн / Продюсування концертів / Організація концертів чи шоу-програм (як ОСНОВНИЙ вид діяльності, не побічна опція) → найм співачки
- Хореографія / Танцювальна студія / Організація видовищно-розважальних заходів → найм танцівниці

is_mismatch=true — у ВСІХ інших випадках, включно з:
- Роздрібна торгівля, перевезення, будівництво, ремонт, виробництво товарів — очевидно нічого спільного
- Заклади громадського харчування (кав'ярня, кафе, ресторан, бар, їдальня) — це продаж їжі й напоїв. НЕ зараховуй "там міг би виступати музикант" як достатнє пояснення — це непряме, гіпотетичне припущення, а не основна діяльність. Так само з готелями, магазинами, салонами краси тощо: "у них теж могла б бути розважальна програма" — це НЕ мисметч=false.
- Будь-яка діяльність, зв'язок якої з роллю ти вигадуєш сам, а не бачиш прямо в формулюванні виду діяльності.

Не додумуй непрямі сценарії на користь роботодавця. Якщо основний вид діяльності явно про щось інше (продаж товару/послуги, не пов'язаної з виробництвом медіа- чи розважального контенту) — це мисметч, навіть якщо теоретично можна уявити виняток.`;

// Детермінований шар, який спрацьовує ДО звернення до AI — для явних
// випадків рішення приймається без AI взагалі: швидше, дешевше і не
// залежить від того, наскільки переконливо сформульований опис вакансії
// зможе "вмовити" модель. AI лишається лише для дійсно неоднозначних
// формулювань виду діяльності, яких немає в жодному зі списків нижче.
const ENTERTAINMENT_ACTIVITY_KEYWORDS = [
  "фото",
  "відео",
  "кіно",
  "продюс",
  "артист",
  "агентств",
  "шоу",
  "концерт",
  "музи",
  "блог",
  "контент",
  "ведуч",
  "конферанс",
  "модельн",
  "танц",
  "хореограф",
  "звукозапис",
  "телебач",
  "медіа",
  "реклам",
  "кастинг",
  "театр",
];

const NON_ENTERTAINMENT_ACTIVITY_KEYWORDS = [
  "кав'ярн",
  "кафе",
  "ресторан",
  "бар",
  "харчуванн",
  "їдальн",
  "торгівл",
  "магазин",
  "перевезенн",
  "вантаж",
  "будівництв",
  "ремонт",
  "клінінг",
  "прибиранн",
  "сільгосп",
  "сільське господарств",
  "охорон",
  "таксі",
  "автосервіс",
  "перукар",
  "манікюр",
  "аптек",
  "нерухом",
  "юридичн",
  "бухгалтер",
  "готел",
  "спа",
];

export async function checkBusinessActivityMismatch(
  title: string,
  description: string,
  businessActivity: string,
): Promise<BusinessActivityMismatchResult | null> {
  const normalized = businessActivity.toLowerCase();
  const hasEntertainmentKeyword = ENTERTAINMENT_ACTIVITY_KEYWORDS.some(
    (kw) => normalized.includes(kw),
  );
  const hasNonEntertainmentKeyword = NON_ENTERTAINMENT_ACTIVITY_KEYWORDS.some(
    (kw) => normalized.includes(kw),
  );

  // Якщо збіглося і те, і те (наприклад, "кав'ярня з живою музикою") —
  // все одно перестраховуємось у бік мисметчу: нехай вирішує адмін,
  // а не евристика.
  if (hasNonEntertainmentKeyword) {
    return {
      isMismatch: true,
      reason: `Заявлений вид діяльності ("${businessActivity}") — це сфера, не пов'язана з виробництвом чи організацією медіа-/розважального контенту.`,
    };
  }

  if (hasEntertainmentKeyword) {
    return { isMismatch: false, reason: null };
  }

  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: ACTIVITY_SYSTEM_PROMPT,
      tools: [ACTIVITY_TOOL],
      tool_choice: { type: "tool", name: ACTIVITY_TOOL.name },
      messages: [
        {
          role: "user",
          content: `Заявлений вид діяльності ФОП: ${businessActivity}\n\nНазва вакансії: ${title}\n\nОпис: ${description}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block) => block.type === "tool_use",
    );

    if (!toolUse || toolUse.type !== "tool_use") {
      return null;
    }

    const input = toolUse.input as {
      is_mismatch: boolean;
      reason: string;
    };

    return {
      isMismatch: input.is_mismatch,
      reason: input.is_mismatch ? input.reason : null,
    };
  } catch (err) {
    console.error("[trust-gate] business activity check failed:", err);
    return null;
  }
}

// Детермінований keyword-фолбек лише для is_women_entertainment_role.
// checkTrustGate вище навмисно fail-open (щоб тимчасова недоступність AI
// не блокувала легітимних роботодавців) — свідомий вибір для трьох з
// чотирьох перевірок. Але саме ця категорія (ризик вербування в
// секс-індустрію) достатньо чутлива, щоб мати незалежний від AI бекап:
// якщо checkTrustGate впав (немає ANTHROPIC_API_KEY, мережа, рейт-ліміт
// тощо) — trustGate === null, і БЕЗ цього фолбека вся перевірка (і старий
// хардблок, і нова звірка КВЕД) мовчки пропускається, бо
// `trustGate?.isWomenEntertainmentRole` — це просто undefined.
const ENTERTAINMENT_ROLE_KEYWORDS = [
  "модел",
  "акторк",
  "актрис",
  "танцівниц",
  "танцовниц",
  "співач",
  "вокалістк",
  "хостес",
  "стриптиз",
  "го-го",
  "гоу-гоу",
  "промоутерк",
  "промо-модел",
];

export function hasObviousEntertainmentRoleKeyword(
  title: string,
  description: string,
): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return ENTERTAINMENT_ROLE_KEYWORDS.some((kw) => text.includes(kw));
}
