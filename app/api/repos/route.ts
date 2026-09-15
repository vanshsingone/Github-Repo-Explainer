import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getOctokit, parseRepoUrl, rateLimited, retryWithBackoff } from "@/lib/github";
import { isIgnoredPath } from "@/lib/filter";
import { db } from "@/lib/db/client";
import { repos, indexingJobs, files as filesTable } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/ensure-user";
import { runIndexingWorker } from "@/workers/indexing";

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const dbUser = await ensureUser(clerkUser);

    const body = await req.json();
    const { githubUrl } = body;

    if (!githubUrl) {
      return NextResponse.json(
        { error: "GitHub URL is required" },
        { status: 400 }
      );
    }

    const repoInfo = parseRepoUrl(githubUrl);
    if (!repoInfo) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format. Use: https://github.com/owner/repo" },
        { status: 400 }
      );
    }

    const { owner, repo } = repoInfo;
    const octokit = getOctokit();

    // Step 1: Get default branch with retry and rate limiting
    const repoResponse = await retryWithBackoff(() =>
      rateLimited(() => octokit.repos.get({ owner, repo }))
    );
    const defaultBranch = repoResponse.data.default_branch;

    // Step 2: Get recursive file tree with retry and rate limiting
    const treeResponse = await retryWithBackoff(() =>
      rateLimited(() => octokit.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: "1",
      }))
    );

    const treeFiles = treeResponse.data.tree;

    // Step 3: Filter files and calculate size
    const maxFiles = 2000;
    const maxSizeBytes = 50 * 1024 * 1024; // 50MB

    let filteredFiles: typeof treeFiles = [];
    let totalSize = 0;

    for (const file of treeFiles) {
      if (file.type === "blob") {
        const path = file.path;

        // Filter out ignored files
        if (isIgnoredPath(path)) {
          continue;
        }

        // Get file size with retry and rate limiting
        const contentResponse = await retryWithBackoff(() =>
          rateLimited(() => octokit.repos.getContent({
            owner,
            repo,
            path,
            ref: defaultBranch,
          }))
        );

        // Handle non-file responses (e.g., submodules)
        if (!Array.isArray(contentResponse.data) && contentResponse.data.type === "file" && contentResponse.data.size) {
          totalSize += contentResponse.data.size;

          if (totalSize > maxSizeBytes) {
            return NextResponse.json(
              {
                error: `Repository exceeds size limit. Total: ${(totalSize / 1024 / 1024).toFixed(2)}MB / Max: 50MB`
              },
              { status: 400 }
            );
          }

          filteredFiles.push(file);
        }
      }

      if (filteredFiles.length > maxFiles) {
        return NextResponse.json(
          {
            error: `Repository exceeds file limit. Total: ${filteredFiles.length} / Max: ${maxFiles}`
          },
          { status: 400 }
        );
      }
    }

    // Step 3b: Fetch file contents for all filtered files
    // Note: We fetch content after size validation to avoid downloading
    // files we'd reject anyway. We fetch contents now to store them
    // after the repo is created.
    const fileContents: Array<{ path: string; content: string; sha: string; size: number }> = [];

    for (const file of filteredFiles) {
      try {
        const contentResponse = await retryWithBackoff(() =>
          rateLimited(() => octokit.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: defaultBranch,
          }))
        );

        if (
          !Array.isArray(contentResponse.data) &&
          contentResponse.data.type === "file" &&
          contentResponse.data.content
        ) {
          const content = Buffer.from(contentResponse.data.content, "base64").toString("utf8");
          fileContents.push({
            path: file.path,
            content,
            sha: contentResponse.data.sha,
            size: contentResponse.data.size,
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch content for ${file.path}:`, err);
        // Skip files that can't be fetched
      }
    }

    // Step 4: Save repo to database
    const result = await db
      .insert(repos)
      .values({
        userId: dbUser.id,
        owner,
        name: repo,
        githubUrl: `https://github.com/${owner}/${repo}`,
        defaultBranch,
      })
      .returning();

    const savedRepo = result[0];

    // Step 4b: Store file contents
    if (fileContents.length > 0) {
      await db.insert(filesTable).values(
        fileContents.map((fc) => ({
          repoId: savedRepo.id,
          path: fc.path,
          content: fc.content,
          sha: fc.sha,
          size: fc.size,
        }))
      );
    }

    // Step 5: Create indexing job
    const jobResult = await db
      .insert(indexingJobs)
      .values({
        repoId: savedRepo.id,
        status: "pending",
        progress: 0,
      })
      .returning();

    const job = jobResult[0];

    // Step 6: Start background indexing worker
    // We don't await this - it runs in the background
    runIndexingWorker().catch((err) =>
      console.error("Indexing worker error:", err)
    );

    // Step 7: Return response
    return NextResponse.json({
      job_id: job.id,
      status: "pending",
      message: "Indexing job started",
      repo: {
        id: savedRepo.id,
        owner,
        name: repo,
        totalFiles: filteredFiles.length,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/repos:", error);

    if (error.message?.includes("GITHUB_TOKEN")) {
      return NextResponse.json(
        { error: "GitHub token not configured. Please contact admin." },
        { status: 500 }
      );
    }

    if (error.status === 404) {
      return NextResponse.json(
        { error: "Repository not found. Check the URL and try again." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process repository" },
      { status: 500 }
    );
  }
}
