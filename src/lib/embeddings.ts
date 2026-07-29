import { getOpenAIClient } from "./openai";

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 вимірів — узгоджено зі схемою БД

/**
 * Генерує embedding-вектор для тексту. Повертає null, якщо текст порожній —
 * викликати генерацію заради порожнього рядка немає сенсу (і коштує грошей).
 */
export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
  });

  return response.data[0].embedding;
}
