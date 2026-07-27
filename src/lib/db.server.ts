// Direct PostgreSQL client for booking data operations.
// Uses Replit's managed DATABASE_URL (runtime-managed secret).
// This bypasses Supabase RLS and is safe to use only in server functions.
// Supabase is still used for authentication (JWT / has_role checks).

import { Pool } from "pg";

let _pool: Pool | undefined;

function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. This is a runtime-managed Replit secret.");
    }
    _pool = new Pool({ connectionString });
  }
  return _pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  values?: unknown[],
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(sql, values);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  values?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, values);
  return rows[0] ?? null;
}
