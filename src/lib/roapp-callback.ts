import { roappAccountScope, roappOnlyEnabled } from "./booking-backend.ts";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db.ts";
import { createRoappClient, roappCredentialsFromEnv, type RoappRequest } from "./roapp.ts";
import { queueRoLifecycle, roStatusIds } from "./roapp-lifecycle.ts";

export function verifyRoSignature(id: string, signature: string, secret: string): boolean {
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^[a-f0-9]{64}$/i.test(signature) || secret.length < 20)
    return false;
  const expected = createHmac("sha256", secret).update(id).digest();
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
  const scope = roappAccountScope();
  const creds = roappCredentialsFromEnv();
  if (!request && !creds) throw new Error("ro_not_configured");
  const call = request || createRoappClient(creds!);
  return sql.transaction(async (tx) => {
    const [mapping] = await tx<{
      booking_id: number;
      total_cents: number;
    }>`select q.booking_id,b.total_cents from roapp_sync_queue q
      join bookings b on b.id=q.booking_id where q.ro_order_id=${orderId} and q.account_scope=${scope} and q.shop_id='white-gloss' and b.shop_id=q.shop_id for update of b`;
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
      scheduled_for: string | Date | null;
      owner_confirmed_at: string | Date | null;
      completed_at: string | Date | null;
    }>`
      select * from roapp_order_state where booking_id=${mapping.booking_id}`;
    if (previous && new Date(previous.remote_modified_at) > modified) return false;
    const approvedId = Number(process.env.ROAPP_APPROVED_STATUS_ID);
    if (!Number.isSafeInteger(approvedId) || approvedId <= 0)
      throw new Error("ro_approval_not_configured");
    const reviewId = Number(process.env.ROAPP_REVIEW_STATUS_ID);
    if (!Number.isSafeInteger(reviewId) || reviewId <= 0 || reviewId === approvedId)
      throw new Error("ro_review_not_configured");
    const awaitingReview = status!.id === reviewId;
    const firmId = Number(process.env.ROAPP_FIRM_STATUS_ID);
    const ownerApprovalStatus = status!.id === approvedId || status!.id === firmId;
    // A changed amount revokes prior approval until the owner explicitly returns
    // the order to the approved status. A provider status is not a signature.
    const fixed =
      (ownerApprovalStatus &&
        (!previous ||
          previous.status_id !== status!.id ||
          (previous.fixed_price && previous.amount_cents === amount))) ||
      Boolean(previous?.fixed_price && previous.amount_cents === amount && !awaitingReview);
    let publicUrl = fixed ? previous?.public_url || null : null;
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
          !/(^|\.)(roapp\.io|roapp\.page|remonline\.app|remonline\.eu)$/.test(url.hostname)
        )
          throw new Error("ro_public_url_invalid");
        publicUrl = url.href;
      }
    }
    const scheduled = order.scheduled_for ? new Date(String(order.scheduled_for)) : null;
    if (scheduled && !Number.isFinite(scheduled.getTime())) throw new Error("ro_schedule_invalid");
    const sameAppointment = Boolean(
      previous?.scheduled_for &&
      scheduled &&
      new Date(previous.scheduled_for).getTime() === scheduled.getTime(),
    );
    const activeIds = roStatusIds("ROAPP_CONFIRMED_STATUS_IDS");
    const completedIds = roStatusIds("ROAPP_COMPLETED_STATUS_IDS");
    // The dedicated owner status attests the human signature check. Never infer
    // signature/payment from an accepted webhook or an arbitrary status label.
    const ownerConfirmed =
      fixed &&
      scheduled &&
      ((status!.id === firmId && previous?.status_id !== firmId) ||
        (previous?.owner_confirmed_at &&
          sameAppointment &&
          [...activeIds, ...completedIds].includes(status!.id!)))
        ? previous?.owner_confirmed_at || new Date().toISOString()
        : null;
    const completed =
      ownerConfirmed && completedIds.includes(status!.id!)
        ? previous?.completed_at || new Date().toISOString()
        : null;
    await tx`insert into roapp_order_state(booking_id,status_id,status_name,amount_cents,inquiry_cents,fixed_price,public_url,scheduled_for,remote_modified_at)
      values(${mapping.booking_id},${status!.id},${status!.name},${amount},${mapping.total_cents},${fixed},${publicUrl},${scheduled?.toISOString() || null}::timestamptz,${modified.toISOString()}::timestamptz)
      on conflict(booking_id) do update set status_id=excluded.status_id,status_name=excluded.status_name,amount_cents=excluded.amount_cents,
      fixed_price=excluded.fixed_price,public_url=excluded.public_url,scheduled_for=excluded.scheduled_for,remote_modified_at=excluded.remote_modified_at,updated_at=now()`;
    await tx`update roapp_order_state set owner_confirmed_at=${ownerConfirmed}::timestamptz,
      completed_at=${completed}::timestamptz where booking_id=${mapping.booking_id}`;
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
    await tx`update roapp_sync_queue set remote_checked_at=now() where booking_id=${mapping.booking_id} and account_scope=${scope}`;
    await queueRoLifecycle(tx, mapping.booking_id);
    return true;
  });
}

export async function reconcileRoOrders(sql: Sql) {
  if (!roappOnlyEnabled()) return { refreshed: 0 };
  const scope = roappAccountScope();
  const rows = await sql<{ ro_order_id: number }>`select ro_order_id from roapp_sync_queue
    where shop_id='white-gloss' and account_scope=${scope} and ro_order_id is not null and status='synced' and (remote_checked_at is null or remote_checked_at < now()-interval '60 seconds')
    order by remote_checked_at nulls first limit 3`;
  let refreshed = 0;
  for (const row of rows) if (await refreshRoOrder(sql, row.ro_order_id)) refreshed++;
  return { refreshed };
}

export async function handleRoCallback(request: Request, sql: Sql) {
  const headers = { "cache-control": "no-store" };
  const secret = process.env.ROAPP_WEBHOOK_SECRET || "";
  if (secret.length < 20)
    return Response.json({ error: "not_configured" }, { status: 503, headers });
  if (Number(request.headers.get("content-length")) > 65536)
    return new Response(null, { status: 413, headers });
  if (!request.body) return new Response(null, { status: 400, headers });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        return new Response(null, { status: 413, headers });
      }
      chunks.push(value);
    }
  } catch {
    return new Response(null, { status: 400, headers });
  } finally {
    reader.releaseLock();
  }
  const text = Buffer.concat(chunks).toString("utf8");
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
  const signature = request.headers.get("x-signature") || "";
  if (typeof body.id !== "string" || !verifyRoSignature(body.id, signature, secret)) {
    // Operational metadata only; never log the secret, signature, event body or customer data.
    const id = typeof body.id === "string" ? body.id : "";
    console.warn(
      "[roapp-webhook] signature_rejected",
      JSON.stringify({
        signatureLength: signature.length,
        idIsUuid: /^[a-f0-9-]{36}$/i.test(id),
      }),
    );
    return new Response(null, { status: 401, headers });
  }
  if (
    body.context?.object_type !== "order" ||
    !Number.isSafeInteger(body.context.object_id) ||
    body.context.object_id! <= 0 ||
    typeof body.event_name !== "string" ||
    !body.event_name.startsWith("Order.")
  )
    return Response.json({ ok: true }, { headers });
  try {
    const refreshed = await refreshRoOrder(sql, body.context.object_id!);
    console.info("[roapp-webhook] accepted", JSON.stringify({ refreshed }));
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: "sync_failed" }, { status: 503, headers });
  }
}
