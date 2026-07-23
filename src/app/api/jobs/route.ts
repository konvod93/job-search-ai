import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { employerProfiles, jobs } from "@/db/schema";

const createJobSchema = z.object({
  title: z.string().min(1, "Вкажіть назву вакансії"),
  description: z.string().min(1, "Вкажіть опис вакансії"),
  location: z.string().optional(),
  employmentType: z.enum([
    "full_time",
    "part_time",
    "contract",
    "internship",
    "remote",
  ]),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  skillsRequired: z.array(z.string()).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

// GET /api/jobs?q=...&location=...&employmentType=...
// Публічний перегляд — тільки опубліковані вакансії
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const location = searchParams.get("location");
  const employmentType = searchParams.get("employmentType");

  const filters = [eq(jobs.status, "published")];

  if (q) {
    filters.push(
      or(ilike(jobs.title, `%${q}%`), ilike(jobs.description, `%${q}%`))!,
    );
  }
  if (location) {
    filters.push(ilike(jobs.location, `%${location}%`));
  }
  if (
    employmentType &&
    [
      "full_time",
      "part_time",
      "contract",
      "internship",
      "remote",
    ].includes(employmentType)
  ) {
    filters.push(
      eq(
        jobs.employmentType,
        employmentType as
          | "full_time"
          | "part_time"
          | "contract"
          | "internship"
          | "remote",
      ),
    );
  }

  const results = await db
    .select()
    .from(jobs)
    .where(and(...filters))
    .orderBy(desc(jobs.createdAt))
    .limit(50);

  return NextResponse.json(results);
}

// POST /api/jobs — створення вакансії, тільки роль employer
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== "employer") {
    return NextResponse.json(
      { error: "Тільки роботодавці можуть створювати вакансії" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = createJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Невалідні дані", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [employerProfile] = await db
    .select({ id: employerProfiles.id })
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, session.user.id))
    .limit(1);

  if (!employerProfile) {
    return NextResponse.json(
      { error: "Профіль роботодавця не знайдено" },
      { status: 404 },
    );
  }

  const [job] = await db
    .insert(jobs)
    .values({
      employerId: employerProfile.id,
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      employmentType: parsed.data.employmentType,
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      skillsRequired: parsed.data.skillsRequired ?? [],
      status: parsed.data.status,
    })
    .returning();

  return NextResponse.json(job, { status: 201 });
}
