import type { Sql } from "./db.ts";
import { roappAccountScope } from "./booking-backend.ts";
import { getPerson, RoappError, type RoappRequest } from "./roapp.ts";
import { isEmailAddress } from "./utils.ts";

export type CurrentContact = {
  name: string | null;
  email: string | null;
  address: string | null;
  source: "ro" | "website";
};

const RO_MAIL_EVENTS = ["wg.ro.reminder", "wg.ro.review"];

/** Reads the customer's current RO contact. A corrected e-mail address in RO
 * replaces the website address and retargets messages that are still queued;
 * sent messages are never repeated. Unsupported or unreadable contact data
 * keeps the website data only when RO offers no single-contact read. With
 * strict=true, transport failures and unexpected payloads propagate so the
 * caller retries or reviews instead of issuing a document with stale data. */
export async function currentRoContact(
  sql: Sql,
  bookingId: number,
  request: RoappRequest,
  options: { strict?: boolean } = { strict: true },
): Promise<CurrentContact> {
  const [row] = await sql<{
    customer_name: string;
    email: string | null;
    ro_contact_id: number | null;
  }>`select b.customer_name,b.email,q.ro_contact_id from bookings b
    join roapp_sync_queue q on q.booking_id=b.id and q.shop_id=b.shop_id
    where b.id=${bookingId} and b.shop_id='white-gloss' and q.account_scope=${roappAccountScope()}`;
  if (!row) throw new RoappError("roapp_contact_mapping_missing", { review: true });
  const website: CurrentContact = {
    name: row.customer_name?.trim() || null,
    email: isEmailAddress(row.email) ? row.email!.trim().toLowerCase() : null,
    address: null,
    source: "website",
  };
  if (!row.ro_contact_id) return website;
  let person;
  try {
    person = await getPerson(request, row.ro_contact_id);
  } catch (error) {
    // Documents must not go to a possibly outdated address: strict callers move
    // the case to review. Reminders (strict=false) keep the website address.
    if (options.strict) throw error;
    return website;
  }
  if (!person) return website;
  const email = person.email && isEmailAddress(person.email) ? person.email : website.email;
  if (email && email !== website.email) {
    await sql.transaction(async (tx) => {
      await tx`update bookings set email=${email} where id=${bookingId} and shop_id='white-gloss'`;
      await tx`update outbound_queue set to_addr=${email},updated_at=now()
        where shop_id='white-gloss' and booking_id=${bookingId} and channel='email'
          and status in ('queued','blocked') and event_type = any(${RO_MAIL_EVENTS})`;
      await tx`insert into automation_events(shop_id, area, event, severity, context)
        values ('white-gloss', 'kontakt', 'email-aus-ro-uebernommen', 'info', ${`WG-${bookingId}`})`;
    });
  }
  return { name: person.name || website.name, email, address: person.address, source: "ro" };
}
