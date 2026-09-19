import { createHash, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db.ts";
import { createRoappClient, roappCredentialsFromEnv, type RoappRequest } from "./roapp.ts";

export function verifyRoSignature(id: string, signature: string, secret: string): boolean {
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^[a-f0-9]{64}$/i.test(signature) || secret.length < 32)
    return false;
  const expected = createHash("sha256")
    .update(id + secret)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function euroCents(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("ro_amount_missing");
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error("ro_amount_invalid");
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents > 2147483647) throw new Error("ro_amount_invalid");
  return cents;
}

/** Fetch canonical data while holding the booking lock. The webhook never supplies prices. */
export async function refreshRoOrder(sql: Sql, orderId: number, request?: RoappRequest) {
  const creds = roappCredentialsFromEnv();
  if (!request && !creds) throw new Error("ro_not_configured");
  const call = request || createRoappClient(creds!);
  return sql.transaction(async (tx) => {
    const [mapping] = await tx<{
      booking_id: number;
      total_cents: number;
    }>`select q.booking_id,b.total_cents from roapp_sync_queue q
      join bookings b on b.id=q.booking_id where q.ro_order_id=${orderId} and q.shop_id='white-gloss' for update of b`;
    if (!mapping) return false;
    const payload = await call<Record<string, unknown>>("GET", `/orders/${orderId}`);
    const order = (payload.data || payload) as Record<string, unknown>;
    const status = order.status as { id?: number; name?: string } | undefined;
    if (
      order.id !== orderId ||
      !Number.isSafeInteger(status?.id) ||
      typeof status?.name !== "string"
    )
      throw new Error("ro_order_invalid");
    const modified = new Date(String(order.modified_at));
    if (!Number.isFinite(modified.getTime())) throw new Error("ro_modified_missing");
    const amount = euroCents(order.total);
    const [previous] = await tx<{
      status_id: number;
      status_name: string;
      amount_cents: number;
      fixed_price: boolean;
      public_url: string | null;
      remote_modified_at: string | Date;
    }>`
      select * from roapp_order_state where booking_id=${mapping.booking_id}`;
    if (previous && new Date(previous.remote_modified_at) > modified) return false;
    const approvedId = Number(process.env.ROAPP_APPROVED_STATUS_ID);
    if (!Number.isSafeInteger(approvedId) || approvedId <= 0)
      throw new Error("ro_approval_not_configured");
    const awaitingReview = status!.name === "Anfrage (Preise prüfen)";
    const fixed = status!.id === approvedId || Boolean(previous?.fixed_price && !awaitingReview);
    let publicUrl = previous?.public_url || null;
    if (fixed && !publicUrl) {
      const link = await call<unknown>("GET", `/orders/${orderId}/public-url`);
      const raw =
        typeof link === "string"
          ? link
          : (link as { url?: string; data?: { url?: string } })?.url ||
            (link as { data?: { url?: string } })?.data?.url;
      if (raw) {
        const url = new URL(raw);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          !/(^|\.)(roapp\.io|remonline\.app|remonline\.eu)$/.test(url.hostname)
        )
          throw new Error("ro_public_url_invalid");
        publicUrl = url.href;
      }
    }
    const scheduled = order.scheduled_for ? new Date(String(order.scheduled_for)) : null;
    if (scheduled && !Number.isFinite(scheduled.getTime())) throw new Error("ro_schedule_invalid");
    await tx`insert into roapp_order_state(booking_id,status_id,status_name,amount_cents,inquiry_cents,fixed_price,public_url,scheduled_for,remote_modified_at)
      values(${mapping.booking_id},${status!.id},${status!.name},${amount},${mapping.total_cents},${fixed},${publicUrl},${scheduled?.toISOString() || null}::timestamptz,${modified.toISOString()}::timestamptz)
      on conflict(booking_id) do update set status_id=excluded.status_id,status_name=excluded.status_name,amount_cents=excluded.amount_cents,
      fixed_price=excluded.fixed_price,public_url=excluded.public_url,scheduled_for=excluded.scheduled_for,remote_modified_at=excluded.remote_modified_at,updated_at=now()`;
    if (
      !previous ||
      previous.status_id !== status!.id ||
      previous.amount_cents !== amount ||
      previous.fixed_price !== fixed
    ) {
      await tx`insert into roapp_order_history(booking_id,status_name,amount_cents,fixed_price)
        values(${mapping.booking_id},${status!.name},${amount},${fixed})`;
    }
    if (fixed)
      await tx`update bookings set total_cents=${amount} where id=${mapping.booking_id} and shop_id='white-gloss'`;
    await tx`update roapp_sync_queue set remote_checked_at=now() where booking_id=${mapping.booking_id}`;
    return true;
  });
}

export async function reconcileRoOrders(sql: Sql) {
  const rows = await sql<{ ro_order_id: number }>`select ro_order_id from roapp_sync_queue
    where shop_id='white-gloss' and ro_order_id is not null and status='synced'
    order by remote_checked_at nulls first limit 10`;
  let refreshed = 0;
  for (const row of rows) if (await refreshRoOrder(sql, row.ro_order_id)) refreshed++;
  return { refreshed };
}

export async function handleRoCallback(request: Request, sql: Sql) {
  const headers = { "cache-control": "no-store" };
  const secret = process.env.ROAPP_WEBHOOK_SECRET || "";
  if (secret.length < 32)
    return Response.json({ error: "not_configured" }, { status: 503, headers });
  if (Number(request.headers.get("content-length")) > 65536)
    return new Response(null, { status: 413, headers });
  const text = await request.text();
  if (text.length > 65536) return new Response(null, { status: 413, headers });
  let body: {
    id?: string;
    event_name?: string;
    context?: { object_id?: number; object_type?: string };
  };
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400, headers });
  }
  if (!body || typeof body !== "object") return new Response(null, { status: 400, headers });
  if (!verifyRoSignature(body.id || "", request.headers.get("x-signature") || "", secret))
    return new Response(null, { status: 401, headers });
  if (
    body.context?.object_type !== "order" ||
    !Number.isSafeInteger(body.context.object_id) ||
    !body.event_name?.startsWith("Order.")
  )
    return Response.json({ ok: true }, { headers });
  try {
    await refreshRoOrder(sql, body.context.object_id!);
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: "sync_failed" }, { status: 503, headers });
  }
}
