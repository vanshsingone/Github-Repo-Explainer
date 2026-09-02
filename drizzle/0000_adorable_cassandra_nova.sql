CREATE TABLE "chat_messages" (
	"id" integer PRIMARY KEY NOT NULL,
	"sessionId" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"repoId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" integer PRIMARY KEY NOT NULL,
	"repoId" integer NOT NULL,
	"filePath" text NOT NULL,
	"startLine" integer NOT NULL,
	"endLine" integer NOT NULL,
	"symbolName" text,
	"language" text,
	"commitSha" text,
	"contentHash" text NOT NULL,
	"vectorId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexing_jobs" (
	"id" integer PRIMARY KEY NOT NULL,
	"repoId" integer NOT NULL,
	"status" text NOT NULL,
	"progress" integer DEFAULT 0,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"error" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"githubUrl" text NOT NULL,
	"defaultBranch" text NOT NULL,
	"lastIndexedSha" text,
	"status" text DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY NOT NULL,
	"clerkId" text NOT NULL,
	"email" text NOT NULL,
	"tier" text DEFAULT 'free',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerkId_unique" UNIQUE("clerkId")
);
