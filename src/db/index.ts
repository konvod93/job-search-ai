import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cachedDb: Db | null = null;

function getDb(): Db {
  if (!cachedDb) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Check your .env file.");
    }
    const sql = neon(process.env.DATABASE_URL);
    cachedDb = drizzle(sql, { schema });
  }
  return cachedDb;
}

// Проксі відкладає підключення до першого реального звернення (в момент
// обробки запиту), а не при імпорті модуля — інакше Next.js падає на етапі
// "Collecting page data" під час build, коли DATABASE_URL ще не в оточенні.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

