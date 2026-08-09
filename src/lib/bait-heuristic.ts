import { inArray, or, ilike, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";

// Ключові слова типових вакансій-приманок (класична схема "Імекс-Дніпро" та
// подібні: людину заманюють на просту роботу, а на місці підміняють на
// консультанта з оплатою від продажів). Список свідомо неповний — це
// сигнал для ручної перевірки адміном, НЕ автоматичний блок: легітимні
// склади/логістичні компанії теж часто наймають пачками.
const BAIT_TITLE_KEYWORDS = [
  "листівк", // роздача листівок
  "охорон", // охоронець
  "вантажник",
  "комплектувальник", // складські ролі
  "офісний працівник",
  "офіс-менеджер",
  "водій", // разом з іншими в переліку — окремо це нормальна вакансія
];

export type BaitPatternResult = {
  count: number;
  titles: string[];
};

/**
 * Рахує, скільки активних (published/pending_review) вакансій з
 * "простих"-приманкових назв є в одного employer'а одночасно. 3+ — привід
 * для ручної перевірки (не автоблок): це операційний почерк bait-and-switch
 * схем, коли одна "компанія" одночасно публікує кілька базових ролей, щоб
 * набрати якнайбільше людей на співбесіду, а потім перенаправити в
 * консультанти.
 */
export async function detectBaitPattern(
  employerId: string,
): Promise<BaitPatternResult> {
  const keywordFilters = BAIT_TITLE_KEYWORDS.map((kw) =>
    ilike(jobs.title, `%${kw}%`),
  );

  const rows = await db
    .select({ id: jobs.id, title: jobs.title })
    .from(jobs)
    .where(
      and(
        eq(jobs.employerId, employerId),
        inArray(jobs.status, ["published", "pending_review"]),
        or(...keywordFilters),
      ),
    );

  return { count: rows.length, titles: rows.map((r) => r.title) };
}
