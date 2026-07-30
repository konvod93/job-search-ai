import { getAnthropicClient } from "./anthropic";

export type ModerationResult = {
  flagged: boolean;
  reason: string | null;
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
          "true, якщо оголошення схоже на МЛМ/фінансову піраміду, шахрайство чи спам-вакансію",
      },
      reason: {
        type: "string" as const,
        description:
          "Короткий (до 15 слів) опис причини українською, якщо flagged=true. Порожній рядок, якщо flagged=false.",
      },
    },
    required: ["flagged", "reason"],
  },
};

const SYSTEM_PROMPT = `Ти — модератор вакансій на джобсайті. Твоя задача — визначити, чи оголошення схоже на:
- МЛМ / мережевий маркетинг / фінансову піраміду (обіцянки доходу від "власних зусиль" без фіксованої ставки, заклики запрошувати друзів, стартові внески)
- Явне шахрайство (передоплата за працевлаштування, підозріло нереалістичні умови)
- Спам / нерелевантний контент

Звичайні вакансії без досвіду роботи (наприклад, стажування, підтримка клієнтів, продавець-консультант із фіксованою ставкою) — це НЕ МЛМ, не позначай їх. Позначай лише коли є реальні маркери піраміди/шахрайства.`;

/**
 * Перевіряє вакансію на ознаки МЛМ/шахрайства/спаму через Claude.
 * Повертає null (замість кидання помилки) при збої AI — виклик коду
 * вирішує, як поводитись у такому випадку (зазвичай — пропустити перевірку).
 */
export async function moderateJobListing(
  title: string,
  description: string,
): Promise<ModerationResult | null> {
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
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

    const input = toolUse.input as { flagged: boolean; reason: string };

    return {
      flagged: input.flagged,
      reason: input.flagged ? input.reason : null,
    };
  } catch (err) {
    console.error("[moderation] AI moderation check failed:", err);
    return null;
  }
}
