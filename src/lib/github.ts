import { Octokit } from "@octokit/rest";

const RATE_LIMIT_DELAY_MS = 500; // 500ms between requests to avoid GitHub API rate limits

export function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set in environment variables");
  }
  return new Octokit({ auth: token });
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  // Match patterns like:
  // - https://github.com/owner/repo
  // - github.com/owner/repo
  // - owner/repo
  const match = url.match(/^(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

/**
 * Rate-limited wrapper for API calls.
 * Adds a delay between requests to avoid hitting GitHub API rate limits.
 */
export async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
  return fn();
}

/**
 * Retry wrapper with exponential backoff for transient failures.
 * Skips retries for 404 (not found) and 401 (unauthorized) errors.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  {
    maxRetries = 3,
    baseDelay = 1000,
  }: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Don't retry on 404 (repo not found) or 401/403 (auth issues)
      if ("status" in error && [404, 401, 403].includes(error.status)) {
        throw error;
      }

      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // exponential: 1s, 2s, 4s...
        console.warn(`GitHub API attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
