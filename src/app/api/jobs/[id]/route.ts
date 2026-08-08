import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";
import { generateEmbedding } from "@/lib/embeddings";
import { moderateJobListing } from "@/lib/moderation";

const updateJobSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  location: z.string().optional(),
  category: z
    .enum([
      "it",
      "construction",
      "manufacturing",
      "trade",
      "drivers",
      "agriculture",
      "government",
      "accounting",
      "education",
      "military",
      "other",
    ])
    .optional(),
  employmentType: z
    .enum(["full_time", "part_time", "contract", "internship", "remote"])
    .optional(),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  skillsRequired: z.array(z.string()).optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
});

async function getJobWithOwner(jobId: string) {
  const [row] = await db
    .select({
      job: jobs,
      employerUserId: employerProfiles.userId,
    })
    .from(jobs)
    .innerJoin(employerProfiles, eq(jobs.employerId, employerProfiles.id))
    .where(eq(jobs.id, jobId))
    .limit(1);

  return row;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await getJobWithOwner(id);

  if (!row) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  return NextResponse.json(row.job);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const row = await getJobWithOwner(id);
  if (!row) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  if (row.employerUserId !== session.user.id) {
    return NextResponse.json(
      { error: "Немає прав на редагування цієї вакансії" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = updateJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Вакансія опублікована/публікується зараз → перевіряємо AI-модерацією
  // (використовуючи вже оновлений текст, якщо title/description змінились
  // у цьому запиті). "Fail open" при збої AI — не блокуємо employer'а.
  const targetStatus = parsed.data.status ?? row.job.status;
  const updates: {
    title?: string;
    description?: string;
    location?: string;
    category?: (typeof parsed.data)["category"];
    employmentType?: (typeof parsed.data)["employmentType"];
    salaryMin?: number;
    salaryMax?: number;
    skillsRequired?: string[];
    status?: "draft" | "published" | "closed" | "pending_review";
    moderationReason?: string | null;
    moderationCategory?:
      | "mlm"
      | "scam"
      | "spam"
      | "exploitation_risk"
      | "other"
      | null;
  } = { ...parsed.data };

  if (targetStatus === "published") {
    const title = parsed.data.title ?? row.job.title;
    const description = parsed.data.description ?? row.job.description;

    const moderation = await moderateJobListing(title, description);

    if (moderation?.flagged) {
      updates.status = "pending_review";
      updates.moderationReason = moderation.reason;
      updates.moderationCategory = moderation.category;
    } else if (moderation) {
      // Пройшло перевірку — прибираємо стару причину флагу, якщо була
      updates.moderationReason = null;
      updates.moderationCategory = null;
    }
  }

  const [updated] = await db
    .update(jobs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();

  const embeddingRelevant =
    parsed.data.title !== undefined ||
    parsed.data.description !== undefined ||
    parsed.data.skillsRequired !== undefined;

  if (embeddingRelevant && updated) {
    try {
      const sourceText = [
        updated.title,
        (updated.skillsRequired ?? []).join(", "),
        updated.description,
      ]
        .filter(Boolean)
        .join("\n");

      const embedding = await generateEmbedding(sourceText);

      if (embedding) {
        await db.update(jobs).set({ embedding }).where(eq(jobs.id, id));
        updated.embedding = embedding;
      }
    } catch (err) {
      console.error("[jobs/[id]] embedding generation failed:", err);
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const row = await getJobWithOwner(id);
  if (!row) {
    return NextResponse.json({ error: "Вакансію не знайдено" }, { status: 404 });
  }

  if (row.employerUserId !== session.user.id) {
    return NextResponse.json(
      { error: "Немає прав на видалення цієї вакансії" },
      { status: 403 },
    );
  }

  await db.delete(jobs).where(eq(jobs.id, id));

  return NextResponse.json({ success: true });
}
