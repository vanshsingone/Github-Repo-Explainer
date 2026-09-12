import { db } from "./client";
import { users } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Ensures a Clerk user has a matching row in the local `users` table.
 * Creates one on first sign-in; returns the DB record either way.
 */
export async function ensureUser(clerkUser: {
  id: string;
  emailAddresses: { emailAddress: string }[];
}) {
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  });

  if (existing) return existing;

  const email =
    clerkUser.emailAddresses[0]?.emailAddress ?? "unknown@example.com";

  const result = await db
    .insert(users)
    .values({
      clerkId: clerkUser.id,
      email,
    })
    .returning();

  return result[0];
}
