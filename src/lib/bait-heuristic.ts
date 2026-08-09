import { inArray, or, ilike, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";

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

export type EmployerBaitPattern = BaitPatternResult & {
  employerId: string;
  companyName: string;
};

/**
 * Сайт-вайд варіант — шукає ВСІХ employer'ів (незалежно від статусу
 * верифікації чи модерації окремих вакансій) з 3+ вакансіями-приманками
 * одночасно. Потрібен окремо від detectBaitPattern, бо верифіковані
 * employer'и публікують одразу в published і ніколи не потрапляють у списки
 * "на модерації"/"на верифікації" — без цієї функції для них перевірка
 * просто ніколи б не викликалась.
 */
export async function detectAllBaitPatterns(): Promise<EmployerBaitPattern[]> {
  const keywordFilters = BAIT_TITLE_KEYWORDS.map((kw) =>
    ilike(jobs.title, `%${kw}%`),
  );

  const rows = await db
    .select({
      employerId: jobs.employerId,
      companyName: employerProfiles.companyName,
      title: jobs.title,
    })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(
      and(
        inArray(jobs.status, ["published", "pending_review"]),
        or(...keywordFilters),
      ),
    );

  const byEmployer = new Map<string, EmployerBaitPattern>();
  for (const row of rows) {
    const existing = byEmployer.get(row.employerId);
    if (existing) {
      existing.count += 1;
      existing.titles.push(row.title);
    } else {
      byEmployer.set(row.employerId, {
        employerId: row.employerId,
        companyName: row.companyName,
        count: 1,
        titles: [row.title],
      });
    }
  }

  return [...byEmployer.values()].filter((e) => e.count >= 3);
}
