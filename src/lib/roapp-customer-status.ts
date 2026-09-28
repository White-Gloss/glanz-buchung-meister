import type { Sql } from "./db.ts";
import { roappAccountScope } from "./booking-backend.ts";
import { roappCustomerStep } from "./roapp-customer-step.ts";
export async function roappCustomerStatus(sql: Sql, bookingId: number, inquiryCents: number) {
  const scope = roappAccountScope();
  const [row] = await sql<{
    status_name: string;
    amount_cents: number;
    inquiry_cents: number;
    fixed_price: boolean;
    public_url: string | null;
    scheduled_for: string | null;
    updated_at: string;
    owner_confirmed_at: string | null;
  }>`select s.status_name,s.amount_cents,s.inquiry_cents,s.fixed_price,s.public_url,s.scheduled_for::text,s.updated_at::text,s.owner_confirmed_at::text
    from roapp_order_state s join roapp_sync_queue q on q.booking_id=s.booking_id
    where s.booking_id=${bookingId} and q.shop_id='white-gloss' and q.account_scope=${scope}`;
  const status =
    row?.status_name === "Termin verbindlich" && !row.owner_confirmed_at
      ? "Termin wird erneut geprüft"
      : row?.status_name || "Anfrage eingegangen";
  const fixed = row?.fixed_price ?? false;
  return {
    status,
    amount: row ? (fixed ? row.amount_cents : row.inquiry_cents) : inquiryCents,
    fixed,
    scheduledFor: row?.scheduled_for || null,
    publicUrl: fixed ? row?.public_url || null : null,
    customerStep: roappCustomerStep(status, fixed),
    updatedAt: row?.updated_at || null,
  };
}
