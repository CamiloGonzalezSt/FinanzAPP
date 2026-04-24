import { Pool } from "pg";
import type { QueryResultRow } from "pg";
import { env } from "../config/env";

export const pool =
  env.databaseUrl.length > 0
    ? new Pool({ connectionString: env.databaseUrl })
    : null;

export async function runQuery<T extends QueryResultRow = QueryResultRow>(queryText: string, params: unknown[] = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }
  return pool.query<T>(queryText, params);
}
