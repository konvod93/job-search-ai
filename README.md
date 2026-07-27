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

🚧 MVP: auth, CRUD вакансій, заявки, AI-парсинг резюме готові. Далі — семантичний матчинг через embeddings.

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

## Антифрод (заплановано, гачки в схемі вже є)

- `jobs.status` має значення `pending_review` — нові вакансії від неперевірених employer'ів проходитимуть модерацію перед публікацією
- `employer_profiles.verified` — прапорець підтвердженої компанії (верифікація через корп. пошту/ЄДРПОУ — логіка пізніше)
- Таблиця `reports` — скарги користувачів на вакансії (МЛМ, шахрайство, спам), розгляд через адмін-панель — окремий крок пізніше

## AI-парсинг резюме

Кандидат вставляє текст резюме на `/candidate/profile` → кнопка "Розпізнати з AI" викликає `claude-haiku-4-5-20251001` через structured tool use → поля (headline, скіли, досвід, короткий summary) заповнюються автоматично, кандидат перевіряє й зберігає вручну (без сліпого автозбереження).
