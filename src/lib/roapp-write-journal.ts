import type { Sql } from "./db.ts";
import { createHash } from "node:crypto";
import { RoappError, type RoappRequest } from "./roapp.ts";

/** A durable intent precedes every external write. After a crash or ambiguous
 * response, reconciliation is required; automatic retries cannot create duplicates.
 * Completed individual items are replayed locally when a later item is retried. */
export function journalRoappWrites(
  sql: Sql,
  bookingId: number,
  transport: RoappRequest,
): RoappRequest {
  return async <T>(
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
    query?: Record<string, string | string[] | undefined>,
  ): Promise<T> => {
    if (method === "GET" || method === "HEAD") return transport<T>(method, path, body, query);
    const suffix = path.endsWith("/items")
      ? `:${body?.entity_id}`
      : path.endsWith("/comments")
        ? `:${createHash("sha256").update(JSON.stringify(body)).digest("hex")}`
        : "";
    const operation = `${method} ${path}${suffix}`;
    const claimed = await sql`insert into roapp_write_journal(booking_id,operation,state)
      values(${bookingId},${operation},'started') on conflict do nothing returning operation`;
    if (!claimed.length) {
      const [previous] = await sql<{
        state: string;
        response: T;
      }>`select state,response from roapp_write_journal
        where booking_id=${bookingId} and operation=${operation}`;
      if (previous?.state === "done") return previous.response;
      throw new RoappError("roapp_write_needs_reconciliation", { review: true });
    }
    let response: T;
    try {
      response = await transport<T>(method, path, body, query);
    } catch (error) {
      // Only a definitive rejection before processing is safe to repeat.
      if (
        error instanceof RoappError &&
        (error.status === 429 || error.code === "roapp_time_budget")
      ) {
        await sql`delete from roapp_write_journal where booking_id=${bookingId} and operation=${operation} and state='started'`;
        throw error;
      }
      throw new RoappError("roapp_write_needs_reconciliation", { review: true, cause: error });
    }
    try {
      await sql`update roapp_write_journal set state='done',response=${JSON.stringify(response ?? null)}::jsonb
        where booking_id=${bookingId} and operation=${operation}`;
    } catch (cause) {
      throw new RoappError("roapp_write_needs_reconciliation", { review: true, cause });
    }
    return response;
  };
}
