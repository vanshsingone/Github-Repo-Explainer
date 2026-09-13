CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"repoId" integer NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"sha" text NOT NULL,
	"size" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
