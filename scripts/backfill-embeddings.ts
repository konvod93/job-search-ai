import "dotenv/config";
import { isNull, eq } from "drizzle-orm";
import { db } from "../src/db";
import { candidateProfiles, jobs } from "../src/db/schema";
import { generateEmbedding } from "../src/lib/embeddings";

async function backfillJobs() {
  const rows = await db
    .select()
    .from(jobs)
    .where(isNull(jobs.embedding));

  console.log(`[jobs] Знайдено ${rows.length} без embedding`);

  for (const job of rows) {
    const sourceText = [job.title, (job.skillsRequired ?? []).join(", "), job.description]
      .filter(Boolean)
      .join("\n");

    try {
      const embedding = await generateEmbedding(sourceText);
      if (embedding) {
        await db.update(jobs).set({ embedding }).where(eq(jobs.id, job.id));
        console.log(`[jobs] ✓ ${job.title} (${job.id})`);
      } else {
        console.log(`[jobs] пропущено (порожній текст): ${job.title}`);
      }
    } catch (err) {
      console.error(`[jobs] ✗ помилка для ${job.title}:`, err);
    }
  }
}

async function backfillCandidates() {
  const rows = await db
    .select()
    .from(candidateProfiles)
    .where(isNull(candidateProfiles.embedding));

  console.log(`[candidates] Знайдено ${rows.length} без embedding`);

  for (const profile of rows) {
    const sourceText = [profile.headline, (profile.skills ?? []).join(", "), profile.resumeText]
      .filter(Boolean)
      .join("\n");

    try {
      const embedding = await generateEmbedding(sourceText);
      if (embedding) {
        await db
          .update(candidateProfiles)
          .set({ embedding })
          .where(eq(candidateProfiles.id, profile.id));
        console.log(`[candidates] ✓ ${profile.fullName} (${profile.id})`);
      } else {
        console.log(
          `[candidates] пропущено (порожній профіль): ${profile.fullName}`,
        );
      }
    } catch (err) {
      console.error(`[candidates] ✗ помилка для ${profile.fullName}:`, err);
    }
  }
}

async function main() {
  await backfillJobs();
  await backfillCandidates();
  console.log("Готово.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
