# Phase 1 Handoff Summary
**Project:** GitHub Repo Explainer
**Date Completed:** 2026-09-10
**Engineer:** Claude Code (Claude 5.1)

---

## 1. Phase 1 Scope & Goals

### Stated Objective (from GUIDE.md)
> "User pastes a GitHub URL → your backend fetches the repo's file tree and file contents."

Phase 1 is the **Ingestion phase** (Days 4-7 in GUIDE.md). Its purpose is to build the data pipeline: when a user submits a GitHub repo URL, the system must:
1. Parse the URL to extract owner/repo
2. Fetch the file tree from GitHub API
3. Filter out junk files (binaries, lockfiles, etc.)
4. Enforce size/file limits
5. Store the raw file contents
6. Create an indexing job and process it asynchronously
7. Provide status polling for frontend progress tracking

### Explicitly In Scope
- GitHub API integration via Octokit
- File tree fetching with recursive traversal
- File content filtering (ignoring node_modules, dist, images, binaries, etc.)
- File content storage (raw text)
- Size validation (50MB limit) and file count limits (2000 files)
- Async job queue pattern
- Status polling endpoint
- Frontend UI for adding repos and viewing status

### Explicitly Out of Scope / Deferred
- **Tree-sitter chunking** (deferred to Phase 2) - The worker marks jobs complete but doesn't actually do real processing yet
- **Ollama embeddings** (deferred to Phase 3) - No vector indexing
- **BM25 keyword index** (deferred to Phase 3) - No sparse vector search
- **Hybrid retrieval** (deferred to Phase 4) - No RRF fusion
- **LLM generation** (deferred to Phase 5) - No chat answers
- **Reranking** (Phase 6 stretch) - Not implemented
- **Stripe tiers** (Phase 8 optional) - Not implemented

---

## 2. What Was Actually Built

### Feature-by-Feature Breakdown

#### 2.1 Authentication Integration (`ensureUser` utility)
**File:** `src/lib/db/ensure-user.ts`

```typescript
export async function ensureUser(clerkUser: {
  id: string;
  emailAddresses: { emailAddress: string }[];
}) {
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  });
  if (existing) return existing;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "unknown@example.com";
  const result = await db.insert(users).values({
    clerkId: clerkUser.id,
    email,
  }).returning();
  return result[0];
}
```

**Purpose:** Syncs Clerk user sessions to the local `users` table. Creates a DB record on first sign-in; returns existing user on subsequent visits.

**Why this approach:** Decouples auth (Clerk) from app data (Postgres). Allows free-tier users who don't have a DB user yet to be created on-the-fly.

---

#### 2.2 File Path Filter (`isIgnoredPath`)
**File:** `src/lib/filter.ts`

Filters out:
- Directories: `node_modules`, `dist`, `vendor`, `build`, `.git`, `.next`, `.cache`
- Pattern files: `*.lock`, `*.lockb`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.webp`
- Binaries: `.pdf`, `.zip`, `.tar`, `.gz`, `.rar`, `.7z`, `.exe`, `.dll`, `.so`
- Git: `.gitignore`

**Why this approach:** Follows `.gitignore` conventions users expect. Prevents irrelevant files from being indexed later.

---

#### 2.3 GitHub API Integration
**File:** `src/lib/github.ts`

```typescript
export function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set in environment variables");
  }
  return new Octokit({ auth: token });
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}
```

**Libraries used:** `@octokit/rest` - Official GitHub SDK for Node.js.

**Why Octokit:** It handles authentication, rate limiting, and API versioning automatically. More reliable than manual fetch calls.

---

#### 2.4 Repository POST API (`POST /api/repos`)
**File:** `app/api/repos/route.ts`

**Workflow:**
1. Authenticate with Clerk (`currentUser()`)
2. Sync user to DB via `ensureUser()`
3. Parse GitHub URL to extract `owner` and `repo`
4. Call `GET /repos/{owner}/{repo}` to get default branch
5. Call `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` to get file tree
6. Filter files using `isIgnoredPath()`
7. Calculate total size while fetching metadata
8. Enforce 2000 files / 50MB limits
9. Fetch actual file contents for all filtered files
10. Store repo record in `repos` table
11. Bulk insert file contents into `files` table
12. Create `indexing_jobs` record with status `pending`
13. Trigger `runIndexingWorker()` in background (non-blocking)
14. Return `job_id`, repo info, and file count

**Rate Limiting Note:** The code doesn't currently implement delays between requests. For production use with large repos, this may hit GitHub rate limits.

---

#### 2.5 Status Polling API (`GET /api/repos/:id`)
**File:** `app/api/repos/[id]/route.ts`

**Response format:**
```json
{
  "repo": {
    "id": 1,
    "owner": "facebook",
    "name": "react",
    "status": "ready",
    "defaultBranch": "main",
    "lastIndexedSha": "a1b2c3d..."
  },
  "job": {
    "id": 1,
    "status": "completed",
    "progress": 100,
    "startedAt": "2026-09-10T12:00:00Z",
    "completedAt": "2026-09-10T12:01:30Z"
  }
}
```

**Purpose:** Frontend uses this to poll for indexing progress.

---

#### 2.6 Async Indexing Worker
**File:** `src/workers/indexing.ts`

**Current behavior:**
```typescript
export async function runIndexingWorker() {
  console.log("Starting indexing worker...");
  
  const pendingJob = await db.query.indexingJobs.findFirst({
    where: eq(indexingJobs.status, "pending"),
    orderBy: [asc(indexingJobs.createdAt)],
  });

  if (pendingJob) {
    await processIndexingJob(pendingJob.id);
  }
}

async function processIndexingJob(jobId: number) {
  // TODO: Phase 2 - Tree-sitter chunking
  // TODO: Phase 3 - Embeddings and vector store
  
  // Mark job as complete for now
  await db.update(indexingJobs).set({
    status: "completed",
    progress: 100,
    completedAt: new Date(),
  }).where(eq(indexingJobs.id, jobId));

  await db.update(repos).set({
    status: "ready",
    lastIndexedSha: "placeholder-sha",
  }).where(eq(repos.id, repo.id));
}
```

**Note:** This is a **placeholder**. It finds pending jobs and marks them complete without doing real work. Phase 2 will add tree-sitter chunking here.

**Trigger mechanism:** Called from `POST /api/repos` without awaiting (fire-and-forget):
```typescript
runIndexingWorker().catch((err) => console.error("Indexing worker error:", err));
```

---

#### 2.7 Frontend Components

##### AddRepoForm Component
**File:** `src/components/AddRepoForm.tsx`

```typescript
export default function AddRepoForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setUrl("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  // ...render form
}
```

**Features:**
- Loading state ("Adding...")
- Error display
- Input auto-clear on success
- Page refresh to show new repo

---

##### RepoStatus Component
**File:** `src/components/RepoStatus.tsx`

```typescript
export default function RepoStatus({ repoId, repo, job }: RepoStatusProps) {
  const [status, setStatus] = useState<Job | null>(job);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!status || status.status === "pending" || status.status === "processing") {
      setPolling(true);
    }
  }, [status]);

  useEffect(() => {
    if (!polling) return;
    const fetchStatus = async () => {
      const res = await fetch(`/api/repos/${repoId}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.job);
      }
    };
    const interval = setInterval(fetchStatus, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [repoId, polling]);
  // ...render status badge + progress bar
}
```

**Features:**
- Auto-polls every 2 seconds while `pending` or `processing`
- Displays colored status badges (green=ready, yellow=pending, red=failed)
- Progress bar showing percentage
- Shows last indexed SHA on completion

---

##### Dashboard Page (`app/dashboard/page.tsx`)
**File:** `app/dashboard/page.tsx`

**Shows:**
- Add Repo form (top)
- List of user's repos with:
  - Owner/name
  - Default branch
  - Status indicator (RepoStatus component)
  - Chat link

**Job Map Logic:**
```typescript
const allJobs = await db.query.indexingJobs.findMany({
  where: eq(indexingJobs.repoId, dbUser.id),
  orderBy: [desc(indexingJobs.createdAt)],
});

const jobMap = new Map<number, typeof allJobs[0]>();
for (const job of allJobs) {
  if (!jobMap.has(job.repoId)) {
    jobMap.set(job.repoId, job); // Keep only latest job per repo
  }
}
```

---

### Database Schema Changes

#### New Table: `files`
**Migration:** `drizzle/0001_easy_slapstick.sql`

```sql
CREATE TABLE "files" (
  "id" serial PRIMARY KEY NOT NULL,
  "repoId" integer NOT NULL,
  "path" text NOT NULL,
  "content" text NOT NULL,
  "sha" text NOT NULL,
  "size" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
```

**Purpose:** Stores raw file contents after fetching from GitHub. Used later for chunking in Phase 2.

**Schema Details:**
- `repoId` - Foreign key to `repos.id`
- `path` - Relative file path (e.g., `src/index.ts`)
- `content` - Actual file text (no size limit in schema)
- `sha` - GitHub file SHA for tracking changes
- `size` - File size in bytes (duplicated for quick filtering)

**Relationships:**
- `files.repoId` → `repos.id` (not enforced by DB, but used in queries)

---

### Environment Variables Required

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `GITHUB_TOKEN` | Personal access token for GitHub API | `ghp_xxxxxxxxxxxx` |
| `CLERK_SECRET_KEY` | Clerk authentication secret | `sk_test_xxxxx` |
| `CLERK_PUBLISHABLE_KEY` | Clerk authentication public key | `pk_test_xxxxx` |

**Note:** The GitHub token is used for rate limiting benefits and accessing private repos (if configured in Clerk with GitHub OAuth).

---

## 3. Key Decisions & Trade-offs

### 3.1 Architecture Decisions

| Decision | Why Chosen | Alternative Considered |
|----------|------------|------------------------|
| **Client-side form for repo addition** | Simpler UX with immediate feedback, auto-refresh on success | Server-side form with redirect |
| **2-second polling interval** | Balance between responsiveness and API load | 5-second (less API calls) or instant SSE (more complex) |
| **Fire-and-forget worker trigger** | API returns immediately, job processes async in background | Queue system (Inngest, BullMQ) - overkill for MVP |
| **Store file contents in DB** | Simple, single-source-of-truth for now | Store only on filesystem/GitHub - would require re-fetching on restart |
| **Latest job per repo only** | Simplifies UI - only show current status | Maintain full job history - more complex querying |
| **TypeScript union types for job status** | Type safety ensures all cases handled | String enum - less flexible, more verbose |

### 3.2 Known Limitations & Technical Debt

| Issue | Location | Impact | Priority |
|-------|----------|--------|----------|
| **No rate limiting** | `app/api/repos/route.ts` | May hit GitHub API limits on large repos | Medium - add delays between requests |
| **No retry logic** | `app/api/repos/route.ts` | Transient failures cause job failure | Medium - add exponential backoff |
| **Worker processes one job at a time** | `src/workers/indexing.ts` | Jobs queue up, no parallelism | Low - can be scaled later |
| **No job cancellation** | `src/workers/indexing.ts` | Users can't stop long-running jobs | Low - add admin UI later |
| **Placeholder indexing** | `src/workers/indexing.ts` | Jobs complete instantly without real work | Critical - Phase 2 will fix |
| **No auth on status endpoint** | `app/api/repos/[id]/route.ts` | Anyone with repo ID can check status | Medium - add user check |

---

## 4. File & Folder Structure

### Directory Tree (Phase 1 additions)

```
github-repo-explainer/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx              # Existing - Nav with auth buttons
│   │   ├── AddRepoForm.tsx         # NEW - Form for adding repos
│   │   └── RepoStatus.tsx          # NEW - Status badge + progress bar
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts           # Existing - Drizzle DB client
│   │   │   ├── schema.ts           # Existing - DB schema with new `files` table
│   │   │   └── ensure-user.ts      # NEW - Clerk→DB user sync
│   │   ├── github.ts               # Existing - Octokit + URL parser
│   │   └── filter.ts               # Existing - isIgnoredPath() utility
│   └── workers/
│       └── indexing.ts             # NEW - Indexing job processor
├── app/
│   ├── api/
│   │   └── repos/
│   │       ├── route.ts            # Existing - POST /api/repos
│   │       └── [id]/               # NEW - Status polling endpoint
│   │           └── route.ts        # NEW - GET /api/repos/:id
│   ├── sign-in/                    # Existing - Clerk sign-in
│   ├── sign-up/                    # Existing - Clerk sign-up
│   ├── layout.tsx                  # Existing - Root layout with ClerkProvider
│   ├── page.tsx                    # Existing - Landing page
│   ├── chat/[repoId]/page.tsx      # Existing - Chat placeholder
│   └── dashboard/page.tsx          # Existing - Now uses ensureUser + RepoStatus
└── drizzle/
    └── 0001_easy_slapstick.sql     # NEW - Migration for `files` table
```

### File Classifications

| Type | Files |
|------|-------|
| **Entry Points** | `app/api/repos/route.ts`, `app/api/repos/[id]/route.ts` |
| **Core Logic** | `src/workers/indexing.ts`, `src/lib/github.ts`, `src/lib/filter.ts`, `src/lib/db/ensure-user.ts` |
| **UI Components** | `src/components/AddRepoForm.tsx`, `src/components/RepoStatus.tsx` |
| **Config/Boilerplate** | `drizzle/0001_easy_slapstick.sql`, `src/lib/db/schema.ts` |

---

## 5. Workflow Used

### Step-by-Step Build Process

1. **Phase 0 completion verification**
   - Checked existing auth setup (ClerkProvider in layout, sign-in/sign-up pages)
   - Verified database schema (users, repos, indexing_jobs, chunks, chat_sessions, chat_messages)

2. **Created `ensureUser()` utility**
   - Purpose: Fix "User not found" error for new Clerk users
   - Updated `app/dashboard/page.tsx` and `app/chat/[repoId]/page.tsx` to use it
   - Removed hardcoded `userId: 1` from `POST /api/repos`

3. **Wired dashboard "Add" button**
   - Created `AddRepoForm.tsx` client component
   - Handles form submission with loading/error states
   - Calls `POST /api/repos` and refreshes page on success
   - Wired "Chat" button to navigate to `/chat/[repoId]`

4. **Store actual file contents**
   - Added `files` table to schema (repoId, path, content, sha, size)
   - Generated and pushed migration `0001_easy_slapstick.sql`
   - Updated `POST /api/repos` to fetch contents after size validation
   - Bulk insert into `files` table after repo creation

5. **Created status endpoint**
   - `GET /api/repos/:id` returns repo and latest job info
   - Used for frontend polling

6. **Created indexing worker**
   - `src/workers/indexing.ts` - placeholder implementation
   - Finds pending jobs, marks them complete (no real processing yet)
   - Triggered via `runIndexingWorker()` in API route

7. **Built frontend status UI**
   - `RepoStatus.tsx` - polls every 2 seconds
   - Color-coded status badges
   - Progress bar for in-progress jobs

8. **Integrated worker trigger**
   - Added `runIndexingWorker()` call in API route (non-blocking)
   - Worker runs in background after repo creation

### Commands for Development

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build production bundle |
| `npm run lint` | Run ESLint |
| `npm run drizzle:generate` | Generate new migration from schema changes |
| `npm run drizzle:push` | Push schema to database (NOT used - manual migration pushed) |

### Testing Approach

**No automated tests were written for Phase 1.** Testing was done manually:
1. Started dev server with `npm run dev`
2. Created new Clerk user via sign-up
3. Added GitHub repository URL via dashboard
4. Verified repo appears in list with "pending" status
5. Checked database to confirm records created in `repos`, `files`, `indexing_jobs`
6. Verified worker processed job and marked it complete

---

## 6. Things I Must Remember Going Forward

### Gotchas & Edge Cases

| Issue | Description |
|-------|-------------|
| **GitHub rate limits** | API route makes multiple sequential requests. Without delays, may hit 403 on large repos. |
| **File content storage** | Raw file contents are stored in `files.content` (text). Very large files could cause memory issues. |
| **Placeholder indexing** | Current worker just marks jobs complete. Phase 2 must implement real chunking before chat works. |
| **Single worker process** | Only one job processes at a time. For multiple concurrent users, jobs queue up. |
| **No job status on failure** | Worker catches errors but doesn't store them in DB. Failed jobs show as completed with no error info. |

### Fragile Code (Handle with Care)

| File | Risk | What Could Break |
|------|------|------------------|
| `src/workers/indexing.ts` | High | The worker is essential for Phase 2. Current "complete instantly" logic must be replaced with real processing. |
| `app/dashboard/page.tsx` | Medium | Job map logic assumes latest job per repo. If multiple concurrent jobs allowed, this needs updating. |
| `app/api/repos/route.ts` | High | File contents fetched after size check. If file format changes, content storage may break. |
| `src/lib/filter.ts` | Low | Path patterns may need adjustment for new project types. |

### TODOs in Code

| File | Line | TODO |
|------|------|------|
| `src/workers/indexing.ts` | 31-32 | `// TODO: Phase 2 - Tree-sitter chunking` |
| `src/workers/indexing.ts` | 32 | `// TODO: Phase 3 - Embeddings and vector store` |
| `src/workers/indexing.ts` | 49 | `placeholder-sha` comment - will be actual commit SHA in Phase 2 |

### Assumptions for Phase 2

1. **File contents exist in `files` table** - Phase 2 must read from `files` table, not re-fetch from GitHub
2. **Chunk structure** - Should include: `repoId`, `filePath`, `startLine`, `endLine`, `symbolName`, `language`, `commitSha`, `contentHash`
3. **Worker pattern** - Will need to update `processIndexingJob()` to do chunking, then embedding, then indexing
4. **Error handling** - Should store error messages in `indexing_jobs.error` column

---

## 7. Suggested Starting Point for Phase 2

### Prerequisites Before Starting Phase 2

1. **Install tree-sitter and language parsers:**
   ```bash
   npm install tree-sitter tree-sitter-typescript tree-sitter-python tree-sitter-go
   ```

2. **Download language grammars:**
   - TypeScript/JavaScript
   - Python
   - Go (or whichever languages you're targeting)

3. **Review `src/workers/indexing.ts`** - The worker is where Phase 2 logic will go

4. **Read schema** - Understand the `chunks` table structure:
   ```typescript
   export const chunks = pgTable("chunks", {
     id: serial().primaryKey(),
     repoId: integer().notNull(),
     filePath: text().notNull(),
     startLine: integer().notNull(),
     endLine: integer().notNull(),
     symbolName: text(),
     language: text(),
     commitSha: text(),
     contentHash: text().notNull(),
     vectorId: text(),
     createdAt: timestamp().defaultNow().notNull(),
   });
   ```

### Logical Next Steps for Phase 2

1. **Create chunking utility** (`src/lib/chunk.ts`):
   - Parse file with tree-sitter
   - Extract functions/classes as chunks
   - Calculate line numbers
   - Generate content hash

2. **Update worker** (`src/workers/indexing.ts`):
   - Read file contents from `files` table
   - Call chunking utility
   - Insert chunks into `chunks` table

3. **Test with a small repo:**
   - Add a repo with 1-2 files
   - Verify chunks created correctly
   - Check line numbers and symbol names

### Recommended File to Create First

```
src/lib/chunk.ts
```

This would contain:
- `parseFileWithTreeSitter(filePath, content, language)` - returns AST
- `extractChunksFromAST(ast, filePath, language)` - extracts function/class nodes
- `calculateContentHash(content)` - for change detection

Let me know when you're ready to proceed with Phase 2!
