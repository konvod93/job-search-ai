import { getAnthropicClient } from "./anthropic";

export type ModerationCategory =
  | "mlm"
  | "scam"
  | "spam"
  | "exploitation_risk"
  | "other";

export type ModerationResult = {
  flagged: boolean;
  reason: string | null;
  category: ModerationCategory | null;
};

const MODERATION_TOOL = {
  name: "submit_moderation_result",
  description: "Повертає результат перевірки оголошення про вакансію",
  input_schema: {
    type: "object" as const,
    properties: {
      flagged: {
        type: "boolean" as const,
        description:
          "true, якщо оголошення підпадає під будь-яку з категорій нижче",
      },
      category: {
        type: "string" as const,
        enum: ["mlm", "scam", "spam", "exploitation_risk", "other"],
        description:
          "Категорія проблеми, якщо flagged=true. 'exploitation_risk' — див. окремий опис нижче.",
      },
      reason: {
        type: "string" as const,
        description:
          "Короткий (до 20 слів) опис причини українською, якщо flagged=true. Порожній рядок, якщо flagged=false.",
      },
    },
    required: ["flagged", "reason", "category"],
  },
};

const SYSTEM_PROMPT = `Ти — модератор вакансій на джобсайті. Твоя задача — визначити, чи оголошення підпадає під одну з категорій:

1. **mlm** — МЛМ / мережевий маркетинг / фінансова піраміда (обіцянки доходу від "власних зусиль" без фіксованої ставки, заклики запрошувати друзів, стартові внески).

2. **scam** — явне шахрайство (передоплата за працевлаштування, підозріло нереалістичні умови).

3. **spam** — спам / нерелевантний контент.

4. **exploitation_risk** — вакансія, під виглядом звичайної роботи, містить вимоги до зовнішності, віку чи статі кандидата, які НЕ мають професійного обґрунтування для заявленої посади. Це поширений патерн маскування вербування в секс-індустрію чи трудову експлуатацію під нібито звичайну роботу (прибиральниця, адміністратор, промоутер, "асистентка" тощо).
   - Ключова ознака: невідповідність вимог суті роботи. Для прибиральниці, кур'єра, продавця, офіс-менеджера тощо зовнішність/вік/стать НЕ мають професійного значення — вимога "дівчина 18-25, приваблива зовнішність" для такої посади є червоним прапорцем.
   - НЕ позначай, якщо вимога до зовнішності/віку/статі логічно випливає із самої суті роботи: акторський/модельний кастинг, фотомодель, роль у виставі/рекламі з конкретним віковим/типажним запитом, роль дитячого аніматора з педагогічною ліцензією тощо. Аніматор у готелі, наприклад, не вимагає конкретної статі чи віку — якщо вакансія вказує стать/вік без зв'язку з обов'язками, це теж привід позначити.
   - Якщо не впевнений — краще позначити для розгляду людиною, ніж пропустити.

Звичайні вакансії без досвіду роботи (стажування, підтримка клієнтів, продавець-консультант із фіксованою ставкою) — це НЕ МЛМ. Позначай лише коли є реальні маркери описаних категорій.`;

/**
 * Перевіряє вакансію на ознаки МЛМ/шахрайства/спаму/потенційної експлуатації
 * через Claude. Повертає null (замість кидання помилки) при збої AI —
 * виклик коду вирішує, як поводитись (зазвичай — пропустити перевірку).
 */
export async function moderateJobListing(
  title: string,
  description: string,
): Promise<ModerationResult | null> {
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      tools: [MODERATION_TOOL],
      tool_choice: { type: "tool", name: MODERATION_TOOL.name },
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
      flagged: boolean;
      reason: string;
      category: ModerationCategory | null;
    };

    return {
      flagged: input.flagged,
      reason: input.flagged ? input.reason : null,
      category: input.flagged ? input.category : null,
    };
  } catch (err) {
    console.error("[moderation] AI moderation check failed:", err);
    return null;
  }
}
