import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { repos, indexingJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureUser } from "@/lib/db/ensure-user";
import Link from "next/link";
import AddRepoForm from "@/components/AddRepoForm";
import RepoStatus from "@/components/RepoStatus";

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-zinc-600">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  // Sync Clerk user to local DB (creates on first visit)
  const dbUser = await ensureUser(user);

  // Get user's repos with their latest job
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, dbUser.id),
    orderBy: (repos, { desc }) => [desc(repos.createdAt)],
  });

  // Get job statuses for all repos

  // Fetch latest job for each repo
  const allJobs = await db.query.indexingJobs.findMany({
    where: eq(indexingJobs.repoId, dbUser.id),
    orderBy: (indexingJobs, { desc }) => [desc(indexingJobs.createdAt)],
  });

  // Create a map of repoId -> latest job
  const jobMap = new Map<number, typeof allJobs[0]>();
  for (const job of allJobs) {
    if (!jobMap.has(job.repoId)) {
      jobMap.set(job.repoId, job);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Welcome back! You have {userRepos.length} repository{userRepos.length !== 1 ? 's' : ''} indexed.
        </p>
      </div>

      {/* Add Repo Section */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-zinc-50/10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add a Repository
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Enter a GitHub repository URL to index its codebase for chatting.
        </p>
        <div className="mt-4">
          <AddRepoForm />
        </div>
      </div>

      {/* Repositories List */}
      {userRepos.length > 0 ? (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-zinc-50/10">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Your Repositories
            </h2>
          </div>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {userRepos.map((repo) => (
              <li key={repo.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      {repo.owner}/{repo.name}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      Default branch: {repo.defaultBranch}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <RepoStatus
                      repoId={repo.id}
                      repo={{
                        id: repo.id,
                        owner: repo.owner,
                        name: repo.name,
                        status: repo.status ?? "pending",
                        defaultBranch: repo.defaultBranch,
                        lastIndexedSha: repo.lastIndexedSha ?? undefined,
                      }}
                      job={
                        jobMap.get(repo.id)
                          ? {
                              id: jobMap.get(repo.id)!.id,
                              status: jobMap.get(repo.id)!.status as
                                | "pending"
                                | "processing"
                                | "completed"
                                | "failed",
                              progress: jobMap.get(repo.id)!.progress ?? 0,
                              error: jobMap.get(repo.id)!.error ?? undefined,
                              startedAt: jobMap.get(repo.id)!.startedAt?.toISOString(),
                              completedAt: jobMap.get(repo.id)!.completedAt?.toISOString(),
                            }
                          : null
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-zinc-600 dark:text-zinc-400">
            No repositories indexed yet. Add one above to get started!
          </p>
        </div>
      )}
    </div>
  );
}
