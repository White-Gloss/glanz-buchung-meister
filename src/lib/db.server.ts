// Direct PostgreSQL client for booking data operations.
// Uses the managed database connection string provided by the backend.
// This bypasses Supabase RLS and is safe to use only in server functions.
// Supabase is still used for authentication (JWT / has_role checks).

import { Pool, type PoolClient } from "pg";

let _pool: Pool | undefined;

function getConnectionString(): string | undefined {
  return (
    process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined
  );
}

function getPool(): Pool {
  if (!_pool) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error("Datenbankverbindung nicht konfiguriert (SUPABASE_DB_URL fehlt).");
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

export type ActorQuery = {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<T | null>;
};

/**
 * Führt Schreibzugriffe in einer Transaktion aus und hinterlegt die E-Mail der
 * handelnden Person als `app.actor_email`.
 *
 * Hintergrund: Admin-Änderungen laufen über diesen Pool und nicht über Supabase.
 * Dort ist `auth.uid()` immer NULL, weshalb der Audit-Trigger die handelnde
 * Person bisher nicht erfassen konnte. Der Trigger liest den Wert jetzt aus
 * dieser Sitzungsvariablen. `set_config(..., true)` gilt nur bis zum Ende der
 * Transaktion, sodass keine Werte auf gepoolte Verbindungen durchsickern.
 */
export async function withActor<T>(
  actorEmail: string | null | undefined,
  run: (db: ActorQuery) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.actor_email', $1, true)", [actorEmail ?? ""]);

    const db: ActorQuery = {
      async query<R = Record<string, unknown>>(sql: string, values?: unknown[]) {
        const result = await client.query(sql, values);
        return result.rows as R[];
      },
      async queryOne<R = Record<string, unknown>>(sql: string, values?: unknown[]) {
        const result = await client.query(sql, values);
        return (result.rows[0] ?? null) as R | null;
      },
    };

    const value = await run(db);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
