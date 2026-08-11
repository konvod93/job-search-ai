import { getAnthropicClient } from "./anthropic";

export type BundledRolesResult = {
  hasBundledRoles: boolean;
  rolesFound: string | null;
};

const TOOL = {
  name: "submit_bundled_roles_result",
  description:
    "Повертає результат перевірки, чи оголошення описує одну посаду чи кілька непов'язаних",
  input_schema: {
    type: "object" as const,
    properties: {
      has_bundled_roles: {
        type: "boolean" as const,
        description:
          "true, якщо в тексті перераховано 2+ явно різних, непов'язаних професій",
      },
      roles_found: {
        type: "string" as const,
        description:
          "Перелічені професії через кому, якщо has_bundled_roles=true. Порожній рядок інакше.",
      },
    },
    required: ["has_bundled_roles", "roles_found"],
  },
};

const SYSTEM_PROMPT = `Кожна вакансія на платформі має описувати ОДНУ конкретну посаду. Якщо роботодавцю потрібно кілька різних спеціалістів — він створює окреме оголошення для кожної посади, це стандартна практика будь-якого джобсайту.

Твоя задача — визначити, чи текст вакансії насправді пакетує кілька явно різних, непов'язаних професій в одному оголошенні. Класичний приклад шахрайської схеми (вербування в "консультанти" з оплатою від продажів під виглядом простої роботи): "Потрібні роздавальники листівок, водії, вантажники, охоронці, офісні працівники" — п'ять непов'язаних професій в одному оголошенні, і всі — типові приманки.

Позначай true, якщо в тексті перераховано 2+ явно різних непов'язаних роботи (не варіації однієї професії чи суміжні обов'язки в межах однієї ролі).

НЕ позначай:
- одну посаду з кількома суміщеними обов'язками ("менеджер із продажу та обслуговування клієнтів" — це одна роль)
- варіації рівня однієї професії ("водій категорії B/C" — це одна професія)
- вимоги до кандидата, які просто перелічують навички ("знання Excel, 1С" — це не професії)`;

/**
 * Перевіряє, чи вакансія пакетує кілька непов'язаних посад в одному
 * оголошенні — типовий почерк bait-and-switch схем (Імекс-Дніпро тощо).
 * Універсальна перевірка — застосовується до ВСІХ employer'ів, не тільки
 * низькодовірених, бо легітимних причин так робити практично немає.
 */
export async function checkBundledRoles(
  title: string,
  description: string,
): Promise<BundledRolesResult | null> {
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
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
      has_bundled_roles: boolean;
      roles_found: string;
    };

    return {
      hasBundledRoles: input.has_bundled_roles,
      rolesFound: input.has_bundled_roles ? input.roles_found : null,
    };
  } catch (err) {
    console.error("[bundled-roles] AI check failed:", err);
    return null;
  }
}
