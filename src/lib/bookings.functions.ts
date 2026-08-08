import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { query, queryOne, withActor } from "@/lib/db.server";
import {
  contactChannels,
  effectivePrice,
  MAX_BOOKINGS_PER_DAY,
  type Booking,
  type BookingSource,
  type BookingStatus,
  type ContactChannel,
} from "./bookings";
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
  booking_time: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_plate: string;
  pickup_city: string | null;
  preferred_contact: string;
  total: number | string;
  agreed_price?: number | string | null;
  offer_note?: string | null;
  offer_alt_dates?: string[] | null;
  booking_source?: BookingSource | null;
  status: string;
  is_new_customer: boolean;
  deposit_amount: number | string;
  deposit_status: string;
  access_token: string;
};

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function isRowLike(value: unknown): value is Row {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Row>;
  return (
    typeof row.id === "string" &&
    typeof row.invoice_number === "string" &&
    typeof row.booking_date === "string"
  );
}

function parseBookingPayload(value: unknown): Row {
  if (typeof value !== "string") {
    if (isRowLike(value)) return value;
    throw new Error("Buchung konnte nicht gelesen werden.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Buchung konnte nicht gelesen werden.");
  }
  if (!isRowLike(parsed)) throw new Error("Buchung konnte nicht gelesen werden.");
  return parsed;
}

function toBooking(row: Row): Booking {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    createdAt: row.created_at,
    vehicleId: row.vehicle_id,
    packageId: row.package_id,
    addOnIds: row.add_on_ids ?? [],
    date: row.booking_date,
    time: row.booking_time ?? null,
    pickupCity: row.pickup_city ?? null,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      plate: row.customer_plate,
    },
    preferredContact: (row.preferred_contact ?? "E-Mail") as ContactChannel,
    total: Number(row.total),
    agreedPrice: row.agreed_price == null ? null : Number(row.agreed_price),
    offerNote: row.offer_note ?? null,
    offerAltDates: (row.offer_alt_dates ?? []).map((d) => String(d).slice(0, 10)),
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
  "preferred_contact",
  "total",
  "agreed_price",
  "offer_note",
  "offer_alt_dates",
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
  name: string;
  email: string;
  phone: string;
  plate: string;
  pickupCity: string | null;
  preferredContact: ContactChannel;
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
  const pickupCity = input.pickupCity ? String(input.pickupCity) : null;
  const preferredContact = contactChannels.includes(input.preferredContact)
    ? input.preferredContact
    : "E-Mail";

  if (!vehicleTypes.some((v) => v.id === vehicleId)) throw new Error("Ungültige Fahrzeugklasse");
  if (!servicePackages.some((p) => p.id === packageId)) throw new Error("Ungültiges Paket");
  if (!addOnIds.every((id) => addOns.some((a) => a.id === id)))
    throw new Error("Ungültige Zusatzleistung");
  if (!isValidIsoDate(date)) throw new Error("Ungültiges Datum");
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

  return {
    vehicleId,
    packageId,
    addOnIds,
    date,
    name,
    email,
    phone,
    plate,
    pickupCity,
    preferredContact,
  };
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
      `SELECT public.create_booking_public($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        data.vehicleId,
        data.packageId,
        data.addOnIds,
        data.date,
        // Uhrzeit wird nicht mehr erhoben. Der Parameter bleibt in der
        // Signatur, damit ein noch nicht ausgetauschter Stand der Anwendung
        // weiter buchen kann — dort landen die Werte sonst um eine Stelle
        // verschoben in den falschen Spalten.
        null,
        data.name,
        data.email,
        data.phone,
        data.plate,
        data.pickupCity,
        data.preferredContact,
      ],
    );
    if (!result) throw new Error("Buchung konnte nicht gespeichert werden.");
    const raw = parseBookingPayload(result.create_booking_public) as Row & { booking_date: string };

    // Die DB-Funktion kann aus Kompatibilitätsgründen einen älteren Row-Shape
    // zurückgeben. Für die neuen Admin-Felder laden wir den Datensatz deshalb
    // einmal vollständig nach.
    const fresh = await queryOne<Row>(`SELECT ${SELECT_COLS} FROM public.bookings WHERE id = $1`, [
      raw.id,
    ]);
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
// getDayLoad — öffentlich. Liefert je künftigem Tag die Zahl belegter Plätze.
//
// Termine sind datumsbasiert; pro Kalendertag sind höchstens
// MAX_BOOKINGS_PER_DAY Buchungen möglich. Der Assistent sperrt damit volle
// Tage im Kalender. Stornierte Buchungen belegen nichts.
//
// Die Zahl ist nur eine Anzeigehilfe — verbindlich entscheidet die
// Datenbank beim Anlegen, sonst könnten zwei gleichzeitige Anfragen
// denselben letzten Platz belegen.
// ---------------------------------------------------------------------------
export const getDayLoad = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await query<{ booking_date: string; used: number | string }>(
    `SELECT booking_date::text, count(*) AS used
       FROM public.bookings
      WHERE booking_date >= current_date
        AND status <> 'Storniert'
      GROUP BY booking_date`,
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.booking_date.slice(0, 10)] = Number(row.used);
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
      `SELECT public.create_booking_public($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        data.vehicleId,
        data.packageId,
        data.addOnIds,
        data.date,
        // Keine Uhrzeit mehr: Termine sind datumsbasiert.
        null,
        data.name,
        data.email,
        data.phone,
        data.plate,
        data.pickupCity,
        data.preferredContact,
      ],
    );
    if (!result) throw new Error("Manuelle Buchung konnte nicht gespeichert werden.");
    const raw = parseBookingPayload(result.create_booking_public);

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

// ---------------------------------------------------------------------------
// GEGENANGEBOT UND DIREKTBESTÄTIGUNG
// ---------------------------------------------------------------------------
// Zwei Wege aus der Prüfung heraus:
//
//   Direktbestätigung  Wunschtermin und berechneter Preis werden
//                      übernommen, der Kunde bekommt die verbindliche
//                      Zusage.
//
//   Gegenangebot       Abweichender Preis mit Begründung und bis zu drei
//                      Ersatztermine. Verbindlich wird daraus erst
//                      etwas, wenn der Kunde einen Termin anklickt.
// ---------------------------------------------------------------------------

/** Tage, an denen noch mindestens ein Platz frei ist – für die Terminauswahl. */
export const getAvailableDates = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, number>> => {
    await assertAdmin(context);
    const rows = await query<{ booking_date: string; used: number | string }>(
      `SELECT booking_date::text, count(*) AS used
         FROM public.bookings
        WHERE booking_date >= current_date
          AND status <> 'Storniert'
        GROUP BY booking_date`,
    );
    const result: Record<string, number> = {};
    for (const row of rows) result[row.booking_date.slice(0, 10)] = Number(row.used);
    return result;
  });

/** Wunschtermin und Standardpreis unverändert bestätigen. */
export const confirmBooking = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<Booking> => {
    await assertAdmin(context);

    const row = await withActor(actorEmailOf(context), async (db) => {
      return db.queryOne<Row>(
        // Direktbestätigung heißt: der berechnete Preis ist der
        // vereinbarte. agreed_price wird deshalb gesetzt, falls es noch
        // leer ist — sonst verstößt der Datensatz gegen die Regel, dass
        // ein bestätigter Termin einen abgestimmten Preis haben muss.
        `UPDATE public.bookings
            SET status = 'Bestätigt',
                agreed_price = COALESCE(agreed_price, total),
                agreed_price_set_at = COALESCE(agreed_price_set_at, now()),
                offer_note = NULL,
                offer_alt_dates = '{}',
                offer_sent_at = NULL,
                updated_at = now()
          WHERE id = $1
          RETURNING ${SELECT_COLS}`,
        [data.id],
      );
    });
    if (!row) throw new Error("Buchung nicht gefunden");
    const booking = toBooking(row);

    try {
      const { sendBookingConfirmed, mailConfigured } = await import("./email.server");
      if (mailConfigured()) await sendBookingConfirmed(booking);
    } catch (error) {
      console.error("[mail] Bestätigung übersprungen:", error);
    }

    return booking;
  });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Gegenangebot senden: angepasster Preis mit Begründung plus bis zu drei
 * Ersatztermine. Der Kunde entscheidet danach per Klick in der E-Mail.
 */
export const sendCounterOffer = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string; price: number | null; note: string; altDates: string[] }) => data)
  .handler(async ({ data, context }): Promise<Booking> => {
    await assertAdmin(context);

    const note = String(data.note ?? "")
      .trim()
      .slice(0, 1000);
    if (note.length < 5) {
      throw new Error("Bitte begründen Sie das Gegenangebot kurz für den Kunden.");
    }

    const price =
      data.price === null || data.price === undefined || Number.isNaN(Number(data.price))
        ? null
        : Math.round(Number(data.price) * 100) / 100;
    if (price !== null && price <= 0) {
      throw new Error("Der Angebotspreis muss größer als 0 sein.");
    }

    // Höchstens drei, jedes Datum nur einmal, keine Vergangenheit.
    const heute = new Date().toISOString().slice(0, 10);
    const altDates = Array.from(
      new Set(
        (Array.isArray(data.altDates) ? data.altDates : []).map((d) => String(d).slice(0, 10)),
      ),
    )
      .filter((d) => ISO_DATE.test(d) && d >= heute)
      .slice(0, 3);

    // Ersatztermine dürfen nur auf Tage zeigen, an denen noch Platz ist —
    // sonst schickt man den Kunden auf einen Termin, den die Datenbank
    // beim Zusagen ablehnen würde.
    if (altDates.length > 0) {
      const belegt = await query<{ booking_date: string; used: number | string }>(
        `SELECT booking_date::text, count(*) AS used
           FROM public.bookings
          WHERE booking_date = ANY($1::date[])
            AND status <> 'Storniert'
          GROUP BY booking_date`,
        [altDates],
      );
      const voll = belegt
        .filter((r) => Number(r.used) >= MAX_BOOKINGS_PER_DAY)
        .map((r) => r.booking_date.slice(0, 10));
      if (voll.length > 0) {
        throw new Error(
          `Diese Ersatztermine sind bereits ausgebucht: ${voll
            .map((d) => new Date(d).toLocaleDateString("de-DE"))
            .join(", ")}`,
        );
      }
    }

    const row = await withActor(actorEmailOf(context), async (db) => {
      return db.queryOne<Row>(
        `UPDATE public.bookings
            SET status = 'Gegenangebot gesendet',
                -- Ohne eigenen Betrag gilt der berechnete Preis als
                -- vereinbart; der Kunde bekommt in jedem Fall eine Zahl
                -- genannt, und die spätere Bestätigung hat ihren Preis.
                agreed_price = COALESCE($2::numeric, total),
                agreed_price_set_at = now(),
                offer_note = $3,
                offer_alt_dates = $4::date[],
                offer_sent_at = now(),
                customer_reply_at = NULL
          WHERE id = $1
          RETURNING ${SELECT_COLS}`,
        [data.id, price, note, altDates],
      );
    });
    if (!row) throw new Error("Buchung nicht gefunden");
    const booking = toBooking(row);

    try {
      const { sendCounterOfferMail, mailConfigured } = await import("./email.server");
      if (mailConfigured()) await sendCounterOfferMail(booking);
    } catch (error) {
      console.error("[mail] Gegenangebot übersprungen:", error);
    }

    return booking;
  });

// ---------------------------------------------------------------------------
// Kundenseite: Angebot ansehen und annehmen (ohne Anmeldung, über Token)
// ---------------------------------------------------------------------------
// Der Zugriff läuft ausschließlich über access_token aus der E-Mail. Es
// werden nur die Felder zurückgegeben, die der Kunde ohnehin in seiner
// Mail stehen hat — keine internen Notizen, keine Audit-Daten.
// ---------------------------------------------------------------------------
export type OfferView = {
  invoiceNumber: string;
  customerName: string;
  status: BookingStatus;
  requestedDate: string;
  altDates: string[];
  price: number;
  note: string | null;
  depositAmount: number;
  isNewCustomer: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getOfferByToken = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<OfferView | null> => {
    if (!UUID.test(String(data.token ?? ""))) return null;
    const row = await queryOne<Row>(
      `SELECT ${SELECT_COLS} FROM public.bookings WHERE access_token = $1`,
      [data.token],
    );
    if (!row) return null;
    const booking = toBooking(row);
    return {
      invoiceNumber: booking.invoiceNumber,
      customerName: booking.customer.name,
      status: booking.status,
      requestedDate: booking.date,
      altDates: booking.offerAltDates,
      price: effectivePrice(booking),
      note: booking.offerNote,
      depositAmount: booking.depositAmount,
      isNewCustomer: booking.isNewCustomer,
    };
  });

/**
 * Der Kunde nimmt einen Termin aus dem Gegenangebot an.
 *
 * Erlaubt sind ausschließlich der ursprüngliche Wunschtermin und die
 * angebotenen Ersatztermine — ein manipuliertes Datum wird abgewiesen.
 * Die Tageskapazität prüft die Datenbank beim Schreiben.
 */
export const acceptOffer = createServerFn({ method: "POST" })
  .validator((data: { token: string; date: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true; date: string }> => {
    if (!UUID.test(String(data.token ?? ""))) throw new Error("Ungültiger Link.");
    const gewaehlt = String(data.date ?? "").slice(0, 10);
    if (!ISO_DATE.test(gewaehlt)) throw new Error("Ungültiges Datum.");

    const row = await queryOne<Row>(
      `SELECT ${SELECT_COLS} FROM public.bookings WHERE access_token = $1`,
      [data.token],
    );
    if (!row) throw new Error("Zu diesem Link gibt es keine Anfrage.");
    const booking = toBooking(row);

    if (booking.status !== "Gegenangebot gesendet") {
      throw new Error(
        booking.status === "Bestätigt"
          ? "Dieser Termin ist bereits bestätigt."
          : "Für diese Anfrage liegt kein offenes Angebot vor.",
      );
    }

    const erlaubt = [booking.date, ...booking.offerAltDates];
    if (!erlaubt.includes(gewaehlt)) {
      throw new Error("Dieser Termin gehört nicht zum Angebot.");
    }

    const aktualisiert = await withActor(booking.customer.email, async (db) => {
      return db.queryOne<Row>(
        `UPDATE public.bookings
            SET booking_date = $2::date,
                status = 'Bestätigt',
                agreed_price = COALESCE(agreed_price, total),
                agreed_price_set_at = COALESCE(agreed_price_set_at, now()),
                customer_reply_at = now(),
                updated_at = now()
          WHERE id = $1
          RETURNING ${SELECT_COLS}`,
        [booking.id, gewaehlt],
      );
    });
    if (!aktualisiert) throw new Error("Der Termin konnte nicht gespeichert werden.");

    try {
      const { sendBookingConfirmed, sendOfferAcceptedToOwner, mailConfigured } =
        await import("./email.server");
      if (mailConfigured()) {
        await sendBookingConfirmed(toBooking(aktualisiert));
        await sendOfferAcceptedToOwner(toBooking(aktualisiert));
      }
    } catch (error) {
      console.error("[mail] Zusage-Benachrichtigung übersprungen:", error);
    }

    return { ok: true, date: gewaehlt };
  });
