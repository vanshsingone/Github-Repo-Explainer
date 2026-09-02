import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = pg.createPool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);
