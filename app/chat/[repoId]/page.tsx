import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { repos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ensureUser } from "@/lib/db/ensure-user";

export default async function ChatPage({
  params,
}: {
  params: { repoId: string };
}) {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-zinc-600">Please sign in to chat with repositories.</p>
      </div>
    );
  }

  const dbUser = await ensureUser(user);

  const repo = await db.query.repos.findFirst({
    where: eq(repos.id, parseInt(params.repoId)),
  });

  if (!repo) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-zinc-600">Repository not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl h-screen flex-col px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {repo.owner}/{repo.name}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Default branch: {repo.defaultBranch}
          </p>
        </div>
        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Ready to chat
        </span>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 rounded-xl bg-white shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-zinc-50/10 flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center dark:bg-zinc-700">
                <span className="text-xs font-medium">AI</span>
              </div>
              <div className="flex-1">
                <p className="text-zinc-900 dark:text-zinc-50">
                  Hello! I can help you explore the <strong>{repo.owner}/{repo.name}</strong> repository.
                  Ask me anything about the codebase.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex gap-4">
            <textarea
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-50 min-h-20"
              placeholder="Ask a question about this repository..."
            />
            <button className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 self-end">
              Send
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Answers are grounded in the indexed codebase with clickable citations.
          </p>
        </div>
      </div>
    </div>
  );
}
