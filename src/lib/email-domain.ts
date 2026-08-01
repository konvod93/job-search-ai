const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "ukr.net",
  "i.ua",
  "meta.ua",
  "bigmir.net",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "mail.ru",
  "proton.me",
  "protonmail.com",
]);

/**
 * Чи email зареєстрований на загальнодоступному поштовому сервісі
 * (gmail, ukr.net тощо), а не на корпоративному домені компанії.
 *
 * Це лише допоміжний сигнал для адміна при ручній верифікації — НЕ підстава
 * для автоматичного рішення. ФОП з gmail.com може бути цілком легальним
 * (наприклад, виконроб бригади), тому цей прапорець не повинен блокувати
 * верифікацію сам по собі.
 */
export function isGenericEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? GENERIC_EMAIL_DOMAINS.has(domain) : false;
}
