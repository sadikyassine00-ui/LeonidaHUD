import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cachedDb: NeonHttpDatabase<typeof schema> | null = null;

export function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!hasDatabaseConfig()) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!cachedDb) {
    const sql = neon(process.env.DATABASE_URL!);
    cachedDb = drizzle(sql, { schema });
  }
  return cachedDb;
}

export { schema };
