import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set. Check your .env file.");
    }
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cachedClient;
}
