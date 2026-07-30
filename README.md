# JobSearch AI

Платформа пошуку роботи з AI-помічником (портфоліо-проект).

## Стек

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4)
- **Drizzle ORM** + **Neon Postgres** (планується)
- **Claude API** — парсинг резюме, чат-помічник
- **Embeddings (OpenAI/Voyage)** — семантичний матчинг вакансія ↔ кандидат

## Запуск

```bash
npm install
npm run dev
```

## Статус

🚧 MVP: auth, CRUD вакансій, заявки, AI-парсинг резюме, семантичний матчинг готові.

## Безпека

⚠️ Проект залежить від Next.js 16.2.11+, яка патчить [CVE-2026-64642](https://github.com/vercel/next.js/security/advisories/GHSA-6gpp-xcg3-4w24) — обхід middleware/proxy-автентифікації в App Router на Turbopack. Тримайте Next.js в актуальному стані.

Кожна приватна сторінка додатково перевіряє сесію й роль на сервері через `requireRole()` (`src/lib/require-role.ts`) — другий рівень захисту, незалежний від `proxy.ts`, на випадок подібних вразливостей middleware в майбутньому.

## Налаштування БД (Neon + Drizzle)

1. Створіть проект на [Neon](https://console.neon.tech), скопіюйте connection string.
2. Скопіюйте `.env.example` у `.env` і вставте `DATABASE_URL`.
3. У Neon SQL Editor (або через міграцію) увімкніть pgvector: `CREATE EXTENSION IF NOT EXISTS vector;`
4. Застосуйте міграцію: `npm run db:migrate` (або `npm run db:push` для швидкого прототипування без файлів міграцій).
5. Переглянути дані: `npm run db:studio`.

## Схема даних

- `users` — акаунт з роллю (candidate / employer / admin)
- `candidate_profiles` — профіль кандидата, `embedding` для семантичного пошуку
- `employer_profiles` — профіль компанії
- `jobs` — вакансії, `embedding` опису для матчингу
- `reports` — скарги на вакансії (антифрод)

## Антифрод / модерація

- **AI-модерація вакансій** (`src/lib/moderation.ts`) — при спробі опублікувати вакансію Claude (`claude-haiku-4-5-20251001`) перевіряє title+description на ознаки МЛМ/фінансової піраміди/шахрайства. Якщо флагується — статус автоматично стає `pending_review` замість `published`, причина зберігається в `jobs.moderationReason` і видима employer'у на дашборді
- **`/admin/jobs`** — адмін-панель зі списком вакансій на модерації, кнопки "Схвалити"/"Відхилити" (`role: admin`)
- Fail-open: якщо AI-перевірка недоступна — вакансія публікується як є (не блокуємо employer'а через тимчасовий збій AI), про це є лог на сервері
- `employer_profiles.verified` — прапорець підтвердженої компанії (верифікація через корп. пошту/ЄДРПОУ — логіка пізніше, поки що просто заготовка)
- Таблиця `reports` — скарги користувачів на вакансії — UI ще не зроблено, окремий крок пізніше

### Як отримати admin-акаунт

Реєстрації адміна через UI навмисно немає (не той функціонал, який повинен бути публічним). Зареєструйтесь як звичайний employer/candidate, потім вручну в Neon SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE email = 'ваш-email@example.com';
```

## AI-парсинг резюме

Кандидат вставляє текст резюме на `/candidate/profile` → кнопка "Розпізнати з AI" викликає `claude-haiku-4-5-20251001` через structured tool use → поля (headline, скіли, досвід, короткий summary) заповнюються автоматично, кандидат перевіряє й зберігає вручну (без сліпого автозбереження).

## Семантичний матчинг (embeddings)

- При збереженні профілю кандидата (`PATCH /api/candidate/profile`) і при створенні/редагуванні вакансії (`POST/PATCH /api/jobs`) генерується embedding (`text-embedding-3-small`, OpenAI, 1536 вимірів) з ключового тексту (headline/скіли/опис)
- На `/candidate/dashboard` — блок "Рекомендовані вакансії", відсортований за косинусною схожістю (`pgvector`, `cosineDistance` з drizzle-orm) між embedding профілю й embedding вакансій
- Генерація embedding не блокує основний запит — якщо OpenAI API впаде, профіль/вакансія все одно збережуться, просто без embedding (спробує оновитись при наступному збереженні)
- **Для продакшену**, коли рядків стане багато (тисячі+), варто додати `HNSW`/`IVFFlat` індекс на колонки `embedding` для швидкого ANN-пошуку — зараз для MVP-обсягів даних послідовне сканування достатньо швидке
