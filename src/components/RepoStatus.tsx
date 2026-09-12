"use client";

import { useEffect, useState } from "react";

interface Job {
  id: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface Repo {
  id: number;
  owner: string;
  name: string;
  status: string;
  defaultBranch: string;
  lastIndexedSha?: string;
}

interface RepoStatusProps {
  repoId: number;
  repo: Repo;
  job: Job | null;
}

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
      try {
        const res = await fetch(`/api/repos/${repoId}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.job);
        }
      } catch (err) {
        console.error("Failed to fetch status:", err);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [repoId, polling]);

  if (!status) return null;

  const isComplete = status.status === "completed";
  const isFailed = status.status === "failed";
  const isProcessing = status.status === "processing";

  let statusColor = "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
  if (isComplete) statusColor = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (isProcessing) statusColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (isFailed) statusColor = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

  return (
    <div className="flex items-center gap-4">
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
        {isComplete ? "Ready" : isFailed ? "Failed" : isProcessing ? "Processing..." : "Pending"}
      </span>

      {isProcessing && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${status.progress}%` }}
            />
          </div>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{status.progress}%</span>
        </div>
      )}

      {isFailed && status.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{status.error}</p>
      )}

      {isComplete && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Indexed {repo.lastIndexedSha?.slice(0, 7) || "latest"}
        </p>
      )}
    </div>
  );
}
