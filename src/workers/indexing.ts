import { db } from "@/lib/db/client";
import { indexingJobs, repos } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Process a single indexing job.
 * This is where the actual indexing logic will go.
 * For now, it's a placeholder that marks jobs as complete.
 */
async function processIndexingJob(jobId: number) {
  const job = await db.query.indexingJobs.findFirst({
    where: eq(indexingJobs.id, jobId),
  });

  if (!job) {
    console.error(`Job ${jobId} not found`);
    return;
  }

  const repo = await db.query.repos.findFirst({
    where: eq(repos.id, job.repoId),
  });

  if (!repo) {
    console.error(`Repo ${job.repoId} not found for job ${jobId}`);
    return;
  }

  console.log(`Processing job ${jobId} for repo ${repo.owner}/${repo.name}`);

  // TODO: Phase 2 - Tree-sitter chunking
  // TODO: Phase 3 - Embeddings and vector store

  // Mark job as complete for now
  await db
    .update(indexingJobs)
    .set({
      status: "completed",
      progress: 100,
      completedAt: new Date(),
    })
    .where(eq(indexingJobs.id, jobId));

  // Mark repo as ready
  await db
    .update(repos)
    .set({
      status: "ready",
      lastIndexedSha: "placeholder-sha", // Will be the actual commit SHA in Phase 2
    })
    .where(eq(repos.id, repo.id));

  console.log(`Completed job ${jobId}`);
}

/**
 * Run the indexing worker.
 * Process one job at a time (can be expanded for parallel processing).
 */
export async function runIndexingWorker() {
  console.log("Starting indexing worker...");

  // Find the oldest pending job
  const pendingJob = await db.query.indexingJobs.findFirst({
    where: eq(indexingJobs.status, "pending"),
    orderBy: (indexingJobs, { asc }) => [asc(indexingJobs.createdAt)],
  });

  if (pendingJob) {
    console.log(`Found pending job ${pendingJob.id}`);
    await processIndexingJob(pendingJob.id);
  } else {
    console.log("No pending jobs. Waiting...");
  }
}

// Run if called directly
if (require.main === module) {
  runIndexingWorker()
    .then(() => {
      console.log("Done");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}
