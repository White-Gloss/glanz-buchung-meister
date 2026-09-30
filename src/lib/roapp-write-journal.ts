import { roappAccountScope } from "./booking-backend.ts";
import type { Sql } from "./db.ts";
import { createHash } from "node:crypto";
import { RoappError, type RoappRequest } from "./roapp.ts";

/** "POST /orders/123/items" → "POST /orders/:id/items": diagnosable, no ids or data. */
export function roappWriteStep(method: string, path: string): string {
  return `${method} ${path.split("?")[0].replace(/\/\d+(?=\/|$)/g, "/:id")}`;
}

/** Journal operation key → normalized step (drops account scope and item suffix). */
export function journalStep(operation: string): string {
  const withoutScope = operation.slice(operation.indexOf(":") + 1);
  const [method, path = ""] = withoutScope.split(" ");
  return roappWriteStep(method, path.replace(/:[^/]*$/, ""));
}

/** True when RO certainly did not perform the write: it was never sent (lease,
 * time budget, account check, rate limit) or RO rejected it with a client error.
 * Timeouts, lost responses and server errors stay ambiguous. */
function certainlyNotWritten(error: unknown): error is RoappError {
  if (!(error instanceof RoappError)) return false;
  if (error.retryable) return true;
  if (
    [
      "roapp_runner_expired",
      "roapp_account_identity_missing",
      "roapp_account_identity_mismatch",
    ].includes(error.code)
  )
    return true;
  return error.status !== null && error.status >= 400 && error.status < 500 && error.status !== 408;
}

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
    const step = roappWriteStep(method, path);
    const suffix = path.endsWith("/items")
      ? `:${body?.entity_id}`
      : path.endsWith("/comments")
        ? `:${createHash("sha256").update(JSON.stringify(body)).digest("hex")}`
        : "";
    const operation = `${roappAccountScope()}:${method} ${path}${suffix}`;
    const claimed = await sql`insert into roapp_write_journal(booking_id,operation,state)
      values(${bookingId},${operation},'started') on conflict do nothing returning operation`;
    if (!claimed.length) {
      const [previous] = await sql<{
        state: string;
        response: T;
      }>`select state,response from roapp_write_journal
        where booking_id=${bookingId} and operation=${operation}`;
      if (previous?.state === "done") return previous.response;
      throw Object.assign(new RoappError("roapp_write_needs_reconciliation", { review: true }), {
        operation: step,
      });
    }
    let response: T;
    try {
      response = await transport<T>(method, path, body, query);
    } catch (error) {
      if (certainlyNotWritten(error)) {
        // Nothing exists in RO: release the intent so a corrected retry may write.
        await sql`delete from roapp_write_journal where booking_id=${bookingId} and operation=${operation} and state='started'`;
        error.operation ??= step;
        throw error;
      }
      const cause = error instanceof RoappError ? error : null;
      throw Object.assign(
        new RoappError("roapp_write_needs_reconciliation", {
          review: true,
          status: cause?.status ?? null,
          detail: cause ? cause.code : "transport_error",
          cause: error,
        }),
        { operation: step },
      );
    }
    try {
      await sql`update roapp_write_journal set state='done',response=${JSON.stringify(response ?? null)}::jsonb
        where booking_id=${bookingId} and operation=${operation}`;
    } catch (cause) {
      throw Object.assign(
        new RoappError("roapp_write_needs_reconciliation", {
          review: true,
          detail: "journal_update_failed",
          cause,
        }),
        { operation: step },
      );
    }
    return response;
  };
}

/** Owner action after checking RO: the write with unclear outcome did NOT arrive
 * there. Releases the stuck intents of this booking so the transfer runs again;
 * completed steps (contact, order, items) are still replayed, never repeated. */
export async function releaseRoappWrites(sql: Sql, bookingId: number): Promise<number> {
  const rows = await sql`delete from roapp_write_journal
    where booking_id=${bookingId} and state='started'
      and operation like ${`${roappAccountScope()}:%`} returning operation`;
  return rows.length;
}
