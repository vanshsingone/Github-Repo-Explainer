import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { repos, indexingJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureUser } from "@/lib/db/ensure-user";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const dbUser = await ensureUser(clerkUser);

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 }
      );
    }

    // Get the repo
    const repo = await db.query.repos.findFirst({
      where: eq(repos.id, id),
    });

    if (!repo) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Check ownership - only allow user to access their own repos
    if (repo.userId !== dbUser.id) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Get the latest indexing job
    const jobs = await db.query.indexingJobs.findMany({
      where: eq(indexingJobs.repoId, id),
      orderBy: (indexingJobs, { desc }) => [desc(indexingJobs.createdAt)],
      limit: 1,
    });

    const job = jobs[0];

    return NextResponse.json({
      repo: {
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        status: repo.status,
        defaultBranch: repo.defaultBranch,
        lastIndexedSha: repo.lastIndexedSha,
      },
      job: job
        ? {
            id: job.id,
            status: job.status,
            progress: job.progress,
            error: job.error,
            startedAt: job.startedAt?.toISOString(),
            completedAt: job.completedAt?.toISOString(),
          }
        : null,
    });
  } catch (error: any) {
    console.error("Error in GET /api/repos/:id:", error);
    return NextResponse.json(
      { error: "Failed to fetch repository status" },
      { status: 500 }
    );
  }
}
