import { integer, text, timestamp, pgTable, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer().primaryKey(),
  clerkId: text().notNull().unique(),
  email: text().notNull(),
  tier: text().default("free"),
  createdAt: timestamp().defaultNow().notNull(),
});

export const repos = pgTable("repos", {
  id: integer().primaryKey(),
  userId: integer().notNull(),
  owner: text().notNull(),
  name: text().notNull(),
  githubUrl: text().notNull(),
  defaultBranch: text().notNull(),
  lastIndexedSha: text(),
  status: text().default("pending"),
  createdAt: timestamp().defaultNow().notNull(),
});

export const indexingJobs = pgTable("indexing_jobs", {
  id: integer().primaryKey(),
  repoId: integer().notNull(),
  status: text().notNull(),
  progress: integer().default(0),
  startedAt: timestamp(),
  completedAt: timestamp(),
  error: text(),
  createdAt: timestamp().defaultNow().notNull(),
});

export const chunks = pgTable("chunks", {
  id: integer().primaryKey(),
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

export const chatSessions = pgTable("chat_sessions", {
  id: integer().primaryKey(),
  userId: integer().notNull(),
  repoId: integer().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: integer().primaryKey(),
  sessionId: integer().notNull(),
  role: text().notNull(),
  content: text().notNull(),
  citations: jsonb(),
  createdAt: timestamp().defaultNow().notNull(),
});
