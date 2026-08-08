import { getAnthropicClient } from "./anthropic";

export type TrustGateResult = {
  hasExternalContact: boolean;
  externalContactPhrase: string | null;
  isWomenEntertainmentRole: boolean;
  entertainmentReason: string | null;
};

const TOOL = {
  name: "submit_trust_gate_result",
  description:
    "Повертає результат перевірки вакансії на дві незалежні ознаки довіри",
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
    },
    required: [
      "has_external_contact",
      "external_contact_phrase",
      "is_women_entertainment_role",
      "entertainment_reason",
    ],
  },
};

const SYSTEM_PROMPT = `Ти аналізуєш текст вакансії на дві незалежні ознаки. Обидві застосовуються тільки до неверифікованих/малодовірених роботодавців — це додатковий бар'єр, поки особу роботодавця не підтверджено вручну.

1. **has_external_contact** — чи оголошення спрямовує кандидата на зв'язок ПОЗА платформою (Telegram, Viber, WhatsApp, Instagram директ, Discord тощо), включно із замаскованими варіантами:
   - заміна "@" словом ("телеграм песик username", "тг собака username", "at username")
   - розбиття юзернейму пробілами/крапками/тире
   - написання назви месенджера з помилками чи через символи, щоб обійти фільтри
   - фрази на кшталт "докладніше в...", "пишіть/дзвоніть в...", "весь список у..." з посиланням на сторонній канал
   Контактний телефон компанії в окремому полі профілю — це нормально, не стосується цієї перевірки. Оцінюєш тільки сам текст вакансії (title+description).

2. **is_women_entertainment_role** — чи вакансія шукає саме ЖІНОК на роль моделі, танцівниці, співачки, акторки чи подібну роль у шоу-бізнесі/індустрії розваг/розважальних закладах. Позначай незалежно від того, виглядає пропозиція легітimною чи ні — сама категорія ролі вимагає додаткової верифікації роботодавця (навіть легітимний театр чи кіностудія повинні підтвердити реєстрацію перед публікацією такої вакансії, бо ця категорія оголошень часто використовується для вербування в секс-індустрію).`;

/**
 * Перевіряє вакансію на зовнішні контакти й на "жіночі" ролі в шоу-бізнесі —
 * обидві перевірки застосовуються лише до неверифікованих/ФОП роботодавців
 * (викликається умовно з роуту, а не завжди). null при збої AI — виклик
 * коду вирішує, як поводитись.
 */
export async function checkTrustGate(
  title: string,
  description: string,
): Promise<TrustGateResult | null> {
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
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
    };
  } catch (err) {
    console.error("[trust-gate] AI check failed:", err);
    return null;
  }
}
