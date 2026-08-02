import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * PRIVATER KALENDER-FEED (.ics)
 * ------------------------------
 * Adresse: /kalender/[token].ics
 *
 * Der Token ist das einzige Geheimnis – kein Login nötig, damit sich die
 * Adresse in jeder Kalender-App (die keinen Cookie-Login unterstützt)
 * abonnieren lässt. Deshalb: Token = zufällige UUID aus
 * `calendar_feed_tokens`, praktisch nicht zu erraten. Wer die Adresse
 * nicht hat, bekommt 404 – nicht "falscher Token", um kein Erraten durch
 * Fehlermeldungen zu erleichtern.
 *
 * Enthält NUR zukünftige, nicht stornierte Buchungen. Vergangene Termine
 * werden nicht rückwirkend eingetragen, damit der Kalender beim ersten
 * Abonnieren nicht mit Alt-Terminen vollläuft.
 */

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsDateTime(dateIso: string, time: string): string {
  const [y, m, d] = dateIso.split("-");
  const [hh, mm] = time.split(":");
  // Alle Termine sind Werkstattzeit (Europe/Berlin) – als lokale Zeit ohne
  // "Z"-Suffix ausgegeben, Kalender-Apps behandeln das als Ortszeit des
  // Geräts. Für eine Werkstatt mit rein lokalem Kundenkreis ausreichend.
  return `${y}${m}${d}T${hh}${mm}00`;
}

function icsTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}

const SLOT_DURATION_HOURS: Record<string, number> = {
  basis: 2,
  premium: 4,
  keramik: 8,
};

export const Route = createFileRoute("/kalender/$token/ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
          return new Response("Not found", { status: 404 });
        }

        const { queryOne, query } = await import("@/lib/db.server");

        const owner = await queryOne<{ user_id: string }>(
          `SELECT user_id FROM public.calendar_feed_tokens WHERE token = $1`,
          [token],
        );
        if (!owner) {
          return new Response("Not found", { status: 404 });
        }

        const { servicePackages, vehicleTypes, addOns, company } =
          await import("@/lib/servicesConfig");
        const { getPickupCity } = await import("@/lib/pickupLocations");

        type Row = {
          id: string;
          invoice_number: string;
          booking_date: string;
          booking_time: string;
          package_id: string;
          vehicle_id: string;
          add_on_ids: string[];
          pickup_city: string | null;
          customer_name: string;
          customer_phone: string;
          customer_plate: string;
          status: string;
          total: string;
        };

        const rows = await query<Row>(
          `SELECT id, invoice_number, booking_date, booking_time, package_id, vehicle_id,
                  add_on_ids, pickup_city, customer_name, customer_phone, customer_plate,
                  status, total
             FROM public.bookings
            WHERE status <> 'Storniert'
              AND booking_date >= (current_date - interval '1 day')
            ORDER BY booking_date, booking_time`,
        );

        const now = icsTimestamp(new Date());
        const events = rows
          .map((row) => {
            const pkg = servicePackages.find((p) => p.id === row.package_id);
            const vehicle = vehicleTypes.find((v) => v.id === row.vehicle_id);
            const extraNames = row.add_on_ids
              .map((id) => addOns.find((a) => a.id === id)?.name)
              .filter((n): n is string => Boolean(n));
            const pickup = row.pickup_city ? getPickupCity(row.pickup_city) : undefined;

            const hours = pkg ? (SLOT_DURATION_HOURS[pkg.id] ?? 2) : 2;
            const start = toIcsDateTime(row.booking_date, row.booking_time);
            const [hh, mm] = row.booking_time.split(":").map(Number);
            const endDate = new Date(`${row.booking_date}T${row.booking_time}:00`);
            endDate.setHours(endDate.getHours() + hours);
            const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}T${String(endDate.getHours()).padStart(2, "0")}${String(mm).padStart(2, "0")}00`;

            const summary = `${pkg?.name ?? row.package_id} – ${row.customer_name} (${row.customer_plate})`;
            const descriptionLines = [
              `Rechnung: ${row.invoice_number}`,
              `Status: ${row.status}`,
              `Fahrzeug: ${vehicle?.name ?? row.vehicle_id}`,
              extraNames.length ? `Zusatzleistungen: ${extraNames.join(", ")}` : null,
              pickup ? `Abholung: ${pickup.name} (${pickup.distanceKm} km)` : null,
              `Telefon: ${row.customer_phone}`,
              `Betrag: ${Number(row.total).toFixed(2)} €`,
            ].filter(Boolean);

            return [
              "BEGIN:VEVENT",
              `UID:${row.id}@whitegloss.de`,
              `DTSTAMP:${now}`,
              `DTSTART:${start}`,
              `DTEND:${end}`,
              `SUMMARY:${escapeIcsText(summary)}`,
              `DESCRIPTION:${escapeIcsText(descriptionLines.join("\\n"))}`,
              pickup
                ? `LOCATION:${escapeIcsText(pickup.name)}`
                : `LOCATION:${escapeIcsText(company.city)}`,
              "END:VEVENT",
            ].join("\r\n");
          })
          .join("\r\n");

        const ics = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//White Gloss Detailing//Buchungen//DE",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          "X-WR-CALNAME:White Gloss – Buchungen",
          "X-WR-TIMEZONE:Europe/Berlin",
          "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
          events,
          "END:VCALENDAR",
        ]
          .filter(Boolean)
          .join("\r\n");

        return new Response(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="whitegloss-buchungen.ics"',
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
