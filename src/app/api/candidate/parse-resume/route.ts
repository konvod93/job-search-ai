import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAnthropicClient } from "@/lib/anthropic";

const requestSchema = z.object({
  resumeText: z.string().min(50, "Текст резюме закороткий для аналізу"),
});

// POST /api/candidate/parse-resume
// Кандидат вставляє текст резюме, Claude повертає структуровані дані
// (headline, скіли, досвід, короткий summary) для попереднього перегляду
// перед збереженням у профіль.
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "candidate") {
    return NextResponse.json(
      { error: "Доступно лише кандидатам" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const client = getAnthropicClient();

  let message;
  try {
    message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: [
        {
          name: "extract_resume_data",
          description: "Витягує структуровані дані з тексту резюме",
          input_schema: {
            type: "object",
            properties: {
              headline: {
                type: "string",
                description:
                  "Коротка професійна назва/позиція кандидата, напр. 'Frontend-розробник'",
              },
              experienceYears: {
                type: "number",
                description:
                  "Загальний досвід роботи в роках (ціле число, оцінка на основі резюме)",
              },
              skills: {
                type: "array",
                items: { type: "string" },
                description:
                  "Список технічних і професійних скілів, витягнутих з резюме",
              },
              summary: {
                type: "string",
                description: "Короткий підсумок про кандидата, 2-3 речення",
              },
            },
            required: ["headline", "skills", "summary"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "extract_resume_data" },
      messages: [
        {
          role: "user",
          content: `Проаналізуй текст резюме нижче і витягни структуровані дані через інструмент extract_resume_data.\n\n---\n${parsed.data.resumeText}\n---`,
        },
      ],
    });
  } catch (err) {
    console.error("[parse-resume] Anthropic API error:", err);
    return NextResponse.json(
      { error: "Помилка звернення до AI. Спробуйте пізніше." },
      { status: 502 },
    );
  }

  const toolUse = message.content.find(
    (block) => block.type === "tool_use",
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json(
      { error: "Не вдалося розпізнати резюме" },
      { status: 502 },
    );
  }

  return NextResponse.json(toolUse.input);
}
