import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { query, queryOne, withActor } from "@/lib/db.server";
import { type Booking, type BookingSource, type BookingStatus } from "./bookings";
import {
  addOns,
  depositConfig,
  isPickupIncluded,
  pickupPricing,
  servicePackages,
  vehicleTypes,
} from "./servicesConfig";
import { getPickupDistanceKm } from "./pickupLocations";

// ---------------------------------------------------------------------------
// Row shape returned by the DB (snake_case) and the create_booking_public fn
// ---------------------------------------------------------------------------
type Row = {
  id: string;
  invoice_number: string;
  created_at: string;
  vehicle_id: string;
  package_id: string;
  add_on_ids: string[] | null;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_plate: string;
  pickup_city: string | null;
  total: number | string;
  agreed_price?: number | string | null;
  booking_source?: BookingSource | null;
  status: string;
  is_new_customer: boolean;
  deposit_amount: number | string;
  deposit_status: string;
  access_token: string;
};

function toBooking(row: Row): Booking {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    createdAt: row.created_at,
    vehicleId: row.vehicle_id,
    packageId: row.package_id,
    addOnIds: row.add_on_ids ?? [],
    date: row.booking_date,
    time: row.booking_time,
    pickupCity: row.pickup_city ?? null,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      plate: row.customer_plate,
    },
    total: Number(row.total),
    agreedPrice: row.agreed_price == null ? null : Number(row.agreed_price),
    bookingSource: row.booking_source ?? "website",
    status: row.status as BookingStatus,
    isNewCustomer: row.is_new_customer,
    depositAmount: Number(row.deposit_amount),
    depositStatus: row.deposit_status as Booking["depositStatus"],
    accessToken: row.access_token,
  };
}

const SELECT_COLS = [
  "id",
  "invoice_number",
  "created_at",
  "vehicle_id",
  "package_id",
  "add_on_ids",
  "booking_date",
  "booking_time",
  "customer_name",
  "customer_email",
  "customer_phone",
  "customer_plate",
  "pickup_city",
  "total",
  "agreed_price",
  "booking_source",
  "status",
  "is_new_customer",
  "deposit_amount",
  "deposit_status",
  "access_token",
].join(", ");

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
export type BookingInput = {
  vehicleId: string;
  packageId: string;
  addOnIds: string[];
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  plate: string;
  pickupCity: string | null;
};

function validate(input: BookingInput): BookingInput {
  const name = String(input.name ?? "")
    .trim()
    .slice(0, 120);
  const email = String(input.email ?? "")
    .trim()
    .slice(0, 160);
  const phone = String(input.phone ?? "")
    .trim()
    .slice(0, 40);
  const plate = String(input.plate ?? "")
    .trim()
    .slice(0, 20)
    .toUpperCase();
  const vehicleId = String(input.vehicleId ?? "");
  const packageId = String(input.packageId ?? "");
  const addOnIds = Array.isArray(input.addOnIds) ? input.addOnIds.slice(0, 20).map(String) : [];
  const date = String(input.date ?? "");
  const time = String(input.time ?? "");
  const pickupCity = input.pickupCity ? String(input.pickupCity) : null;

  if (!vehicleTypes.some((v) => v.id === vehicleId)) throw new Error("Ungültige Fahrzeugklasse");
  if (!servicePackages.some((p) => p.id === packageId)) throw new Error("Ungültiges Paket");
  if (!addOnIds.every((id) => addOns.some((a) => a.id === id)))
    throw new Error("Ungültige Zusatzleistung");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Ungültiges Datum");
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("Ungültige Uhrzeit");
  if (name.length < 2) throw new Error("Bitte einen gültigen Namen angeben");
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) throw new Error("Ungültige E-Mail-Adresse");
  if (phone.length < 6) throw new Error("Ungültige Telefonnummer");
  if (plate.length < 3) throw new Error("Ungültiges Kennzeichen");

  // Abholservice: ohne gültigen Abholort lässt sich der Staffelpreis nicht bestimmen.
  const pickupAddOn = addOns.find((a) => a.distanceBased);
  if (pickupAddOn && addOnIds.includes(pickupAddOn.id)) {
    const distanceKm = getPickupDistanceKm(pickupCity);
    if (distanceKm === null) {
      throw new Error("Bitte wählen Sie einen Abholort für den Hol- & Bringservice.");
    }
    if (!isPickupIncluded(packageId, distanceKm) && distanceKm > pickupPricing.maxKm) {
      throw new Error(
        `Abholungen über ${pickupPricing.maxKm} km kalkulieren wir individuell. Bitte kontaktieren Sie uns direkt.`,
      );
    }
  }

  return { vehicleId, packageId, addOnIds, date, time, name, email, phone, plate, pickupCity };
}

// ---------------------------------------------------------------------------
// createBooking — public, no auth required.
// Calls the booking function in the configured PostgreSQL database, which
// computes totals, invoice number, and deposit server-side from service_prices.
// ---------------------------------------------------------------------------
export const createBooking = createServerFn({ method: "POST" })
  .validator((data: BookingInput) => validate(data))
  .handler(async ({ data }) => {
    const result = await queryOne<{ create_booking_public: string }>(
      `SELECT public.create_booking_public($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        data.vehicleId,
        data.packageId,
        data.addOnIds,
        data.date,
        data.time,
        data.name,
        data.email,
        data.phone,
        data.plate,
        data.pickupCity,
      ],
    );
    if (!result) throw new Error("Buchung konnte nicht gespeichert werden.");
    const raw: Row & { booking_date: string } =
      typeof result.create_booking_public === "string"
        ? JSON.parse(result.create_booking_public)
        : (result.create_booking_public as unknown as Row);

    // Die DB-Funktion kann aus Kompatibilitätsgründen einen älteren Row-Shape
    // zurückgeben. Für die neuen Admin-Felder laden wir den Datensatz deshalb
    // einmal vollständig nach.
    const fresh = await queryOne<Row>(`SELECT ${SELECT_COLS} FROM public.bookings WHERE id = $1`, [raw.id]);
    const booking = fresh
      ? toBooking({ ...fresh, booking_date: String(fresh.booking_date) })
      : toBooking({ ...raw, booking_date: String(raw.booking_date) });

    // Benachrichtigungen verschicken. Bewusst NACH dem erfolgreichen Speichern
    // und mit eigenem Fehlerabfang: Eine gestörte Zustellung darf die bereits
    // gespeicherte Buchung nicht zu einem Fehler für den Kunden machen.
    try {
      const { sendBookingMails } = await import("./email.server");
      await sendBookingMails(booking);
    } catch (error) {
      console.error("[mail] Versand übersprungen:", error);
    }

    return booking;
  });

// ---------------------------------------------------------------------------
// getBookedSlots — public, returns booked (date → time[]) for future dates.
// Only non-cancelled bookings count as blocked.
// ---------------------------------------------------------------------------
export const getBookedSlots = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await query<{ booking_date: string; booking_time: string }>(
    `SELECT booking_date::text, booking_time
       FROM public.bookings
      WHERE booking_date >= current_date
        AND status <> 'Storniert'`,
  );
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    const d = row.booking_date.slice(0, 10);
    if (!result[d]) result[d] = [];
    result[d].push(row.booking_time);
  }
  return result;
});

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims?: { email?: unknown };
};

/** E-Mail der angemeldeten Person aus den JWT-Claims – für den Audit-Log-Eintrag. */
function actorEmailOf(context: AuthContext): string | null {
  const email = context.claims?.email;
  return typeof email === "string" && email.length > 0 ? email : null;
}

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

// ---------------------------------------------------------------------------
// listBookings — admin only
// ---------------------------------------------------------------------------
export const listBookings = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const rows = await query<Row>(
      `SELECT ${SELECT_COLS} FROM public.bookings ORDER BY created_at DESC`,
    );
    return rows.map(toBooking);
  });

// ---------------------------------------------------------------------------
// createManualBooking — admin only (WhatsApp / Telefon / vor Ort)
// ---------------------------------------------------------------------------
export const createManualBooking = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((input: BookingInput & { source: BookingSource }) => {
    const booking = validate(input);
    const source = String(input.source) as BookingSource;
    if (!(["whatsapp", "telefon", "vor_ort", "sonstiges"] as BookingSource[]).includes(source)) {
      throw new Error("Ungültige Buchungsquelle");
    }
    return { ...booking, source };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const result = await queryOne<{ create_booking_public: string }>(
      `SELECT public.create_booking_public($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        data.vehicleId,
        data.packageId,
        data.addOnIds,
        data.date,
        data.time,
        data.name,
        data.email,
        data.phone,
        data.plate,
        data.pickupCity,
      ],
    );
    if (!result) throw new Error("Manuelle Buchung konnte nicht gespeichert werden.");
    const raw =
      typeof result.create_booking_public === "string"
        ? (JSON.parse(result.create_booking_public) as Row)
        : (result.create_booking_public as unknown as Row);

    const row = await withActor(actorEmailOf(context), (db) =>
      db.queryOne<Row>(
        `UPDATE public.bookings
            SET booking_source = $2,
                notes = concat_ws(E'\n', nullif(notes, ''), $3),
                updated_at = now()
          WHERE id = $1
          RETURNING ${SELECT_COLS}`,
        [raw.id, data.source, `Manuell erfasst · Quelle: ${data.source}`],
      ),
    );
    if (!row) throw new Error("Manuelle Buchung konnte nicht geladen werden.");
    return toBooking(row);
  });

// ---------------------------------------------------------------------------
// updateBookingAgreedPrice — admin only
// ---------------------------------------------------------------------------
export const updateBookingAgreedPrice = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string; agreedPrice: number }) => {
    const agreedPrice = Number(data.agreedPrice);
    if (!Number.isFinite(agreedPrice) || agreedPrice <= 0 || agreedPrice > 100000) {
      throw new Error("Bitte einen gültigen vereinbarten Preis eingeben.");
    }
    return { id: String(data.id), agreedPrice: Math.round(agreedPrice * 100) / 100 };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const deposit = Math.round(data.agreedPrice * depositConfig.rate * 100) / 100;
    const row = await withActor(actorEmailOf(context), (db) =>
      db.queryOne<Row>(
        `UPDATE public.bookings
            SET agreed_price = $2,
                agreed_price_set_at = now(),
                deposit_amount = CASE WHEN deposit_status = 'offen' THEN $3 ELSE deposit_amount END,
                updated_at = now()
          WHERE id = $1
          RETURNING ${SELECT_COLS}`,
        [data.id, data.agreedPrice, deposit],
      ),
    );
    if (!row) throw new Error("Buchung nicht gefunden");
    return toBooking(row);
  });

// ---------------------------------------------------------------------------
// updateBookingStatus — admin only
// ---------------------------------------------------------------------------
export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string; status: BookingStatus }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    // Den bisherigen Status und den vom Admin vereinbarten Preis mitlesen.
    // Ein Termin darf ausdrücklich erst bestätigt werden, wenn der konkrete
    // Preis nach Prüfung der Angaben/Fotos gespeichert wurde.
    const { row, vorher } = await withActor(actorEmailOf(context), async (db) => {
      const alt = await db.queryOne<{ status: string; agreed_price: number | string | null }>(
        `SELECT status, agreed_price FROM public.bookings WHERE id = $1 FOR UPDATE`,
        [data.id],
      );
      if (!alt) return { row: null, vorher: null };
      if (data.status === "Bestätigt" && alt.agreed_price == null) {
        throw new Error(
          "Bitte zuerst unter „Unterlagen & Preis“ den mit dem Kunden vereinbarten Preis speichern.",
        );
      }
      const aktualisiert = await db.queryOne<Row>(
        `UPDATE public.bookings SET status = $1, updated_at = now() WHERE id = $2 RETURNING ${SELECT_COLS}`,
        [data.status, data.id],
      );
      return { row: aktualisiert, vorher: alt.status };
    });
    if (!row) throw new Error("Buchung nicht gefunden");

    const booking = toBooking(row);

    /*
     * Verbindliche Terminbestätigung an den Kunden. Bewusst nach dem
     * Speichern und in einem eigenen try/catch: Ein gestörter Mailversand
     * darf den Statuswechsel im Admin-Bereich nicht scheitern lassen.
     */
    if (data.status === "Bestätigt" && vorher !== "Bestätigt") {
      try {
        const { sendBookingConfirmed, mailConfigured } = await import("./email.server");
        if (mailConfigured()) {
          const ergebnis = await sendBookingConfirmed(booking);
          if (!ergebnis.sent) {
            console.error(`[mail] Terminbestätigung nicht zugestellt: ${ergebnis.reason}`);
          }
        } else {
          console.warn(
            `[mail] Versand nicht konfiguriert — keine Terminbestätigung zu ${booking.invoiceNumber} verschickt.`,
          );
        }
      } catch (error) {
        console.error("[mail] Terminbestätigung fehlgeschlagen", error);
      }
    }

    return booking;
  });

// ---------------------------------------------------------------------------
// updateDepositStatus — admin only
// ---------------------------------------------------------------------------
export const updateDepositStatus = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string; depositStatus: Booking["depositStatus"] }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = await withActor(actorEmailOf(context), (db) =>
      db.queryOne<Row>(
        `UPDATE public.bookings SET deposit_status = $1, updated_at = now() WHERE id = $2 RETURNING ${SELECT_COLS}`,
        [data.depositStatus, data.id],
      ),
    );
    if (!row) throw new Error("Buchung nicht gefunden");
    return toBooking(row);
  });

// ---------------------------------------------------------------------------
// deleteBooking — admin only
// ---------------------------------------------------------------------------
export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await withActor(actorEmailOf(context), (db) =>
      db.query(`DELETE FROM public.bookings WHERE id = $1`, [data.id]),
    );
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// isAdminUser
// ---------------------------------------------------------------------------
export const isAdminUser = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export type AuditLogEntry = {
  id: string;
  bookingId: string;
  invoiceNumber: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditLogEntry[]> => {
    await assertAdmin(context);
    const rows = await query<{
      id: string;
      booking_id: string;
      invoice_number: string | null;
      action: string;
      field: string | null;
      old_value: string | null;
      new_value: string | null;
      actor_email: string | null;
      created_at: string;
    }>(
      `SELECT id, booking_id, invoice_number, action, field, old_value, new_value, actor_email, created_at
         FROM public.booking_audit_log
        ORDER BY created_at DESC
        LIMIT 200`,
    );
    return rows.map((r) => ({
      id: r.id,
      bookingId: r.booking_id,
      invoiceNumber: r.invoice_number,
      action: r.action,
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
      actorEmail: r.actor_email,
      createdAt: r.created_at,
    }));
  });
