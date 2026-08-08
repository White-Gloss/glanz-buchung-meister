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

/** YYYY-MM-DD -> YYYYMMDD für Ganztagestermine. */
function toIcsDate(dateIso: string): string {
  return dateIso.slice(0, 10).replace(/-/g, "");
}

/** Verschiebt ein ISO-Datum um n Tage und gibt es im ICS-Format zurück. */
function shiftIcsDate(dateIso: string, days: number): string {
  const d = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function icsTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}

/**
 * Erinnerung zur Uhrzeit-Absprache: drei Tage vor dem Termin.
 *
 * Bewusst als Kalendereintrag statt als Cronjob — der Feed wird ohnehin
 * regelmäßig abgerufen, damit steht die Erinnerung im Kalender, ohne dass
 * beim Hoster ein Zeitplandienst laufen muss.
 */
const REMINDER_DAYS_BEFORE = 3;

/** Nur für Termine, die tatsächlich stattfinden. */
const CONFIRMED_STATUSES = new Set(["Bestätigt", "Ausstehend", "Bezahlt"]);

export const Route = createFileRoute("/kalender/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // Bei der Escaped-Dot-Dateikonvention ("$token[.]ics") liefert der
        // Router die Endung als Teil des Parameterwerts mit
        // ({"token.ics": "abc-123.ics"}) statt sie abzuschneiden — deshalb
        // hier manuell entfernen.
        // Manche Kalender-Apps hängen die Endung an die letzte URL-Komponente
        // an (z. B. wird "token" zu "token.ics" im Pfad) — vorsorglich strippen,
        // falls der Token so ankommt.
        const rawToken = params.token ?? "";
        const token = rawToken.replace(/\.ics$/i, "");
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
          package_id: string;
          vehicle_id: string;
          add_on_ids: string[];
          pickup_city: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email: string;
          customer_plate: string;
          status: string;
          total: string;
        };

        const rows = await query<Row>(
          `SELECT id, invoice_number, booking_date, package_id, vehicle_id,
                  add_on_ids, pickup_city, customer_name, customer_phone, customer_email,
                  customer_plate, status, total
             FROM public.bookings
            WHERE status <> 'Storniert'
              AND booking_date >= (current_date - interval '1 day')
            ORDER BY booking_date`,
        );

        const now = icsTimestamp(new Date());
        const events = rows
          .flatMap((row) => {
            const pkg = servicePackages.find((p) => p.id === row.package_id);
            const vehicle = vehicleTypes.find((v) => v.id === row.vehicle_id);
            const extraNames = row.add_on_ids
              .map((id) => addOns.find((a) => a.id === id)?.name)
              .filter((n): n is string => Boolean(n));
            const pickup = row.pickup_city ? getPickupCity(row.pickup_city) : undefined;
            const datum = row.booking_date.slice(0, 10);

            // Ganztägig: Termine sind datumsbasiert, die Uhrzeit wird
            // wenige Tage vorher abgesprochen. DTEND ist bei ICS-
            // Ganztagesterminen exklusiv, deshalb der Folgetag.
            const start = toIcsDate(datum);
            const end = shiftIcsDate(datum, 1);

            const summary = `${pkg?.name ?? row.package_id} – ${row.customer_name} (${row.customer_plate})`;
            const descriptionLines = [
              `Rechnung: ${row.invoice_number}`,
              `Status: ${row.status}`,
              `Fahrzeug: ${vehicle?.name ?? row.vehicle_id}`,
              extraNames.length ? `Zusatzleistungen: ${extraNames.join(", ")}` : null,
              pickup ? `Abholung: ${pickup.name} (${pickup.distanceKm} km)` : null,
              `Telefon: ${row.customer_phone}`,
              `Betrag: ${Number(row.total).toFixed(2)} €`,
              "Uhrzeit wird individuell abgestimmt.",
            ].filter(Boolean);

            const termin = [
              "BEGIN:VEVENT",
              `UID:${row.id}@whitegloss.de`,
              `DTSTAMP:${now}`,
              `DTSTART;VALUE=DATE:${start}`,
              `DTEND;VALUE=DATE:${end}`,
              `SUMMARY:${escapeIcsText(summary)}`,
              `DESCRIPTION:${escapeIcsText(descriptionLines.join("\\n"))}`,
              pickup
                ? `LOCATION:${escapeIcsText(pickup.name)}`
                : `LOCATION:${escapeIcsText(company.city)}`,
              "END:VEVENT",
            ].join("\r\n");

            if (!CONFIRMED_STATUSES.has(row.status)) return [termin];

            // Erinnerung zur Uhrzeit-Absprache, exakt drei Tage vorher.
            const erinnerungStart = shiftIcsDate(datum, -REMINDER_DAYS_BEFORE);
            const erinnerungEnde = shiftIcsDate(datum, -REMINDER_DAYS_BEFORE + 1);
            const erinnerungText =
              `Uhrzeit vereinbaren mit ${row.customer_name} – Tel: ${row.customer_phone} / ` +
              `E-Mail: ${row.customer_email} (Fahrzeug: ${vehicle?.name ?? row.vehicle_id}, ` +
              `Kennzeichen: ${row.customer_plate})`;

            const erinnerung = [
              "BEGIN:VEVENT",
              `UID:${row.id}-erinnerung@whitegloss.de`,
              `DTSTAMP:${now}`,
              `DTSTART;VALUE=DATE:${erinnerungStart}`,
              `DTEND;VALUE=DATE:${erinnerungEnde}`,
              `SUMMARY:${escapeIcsText(erinnerungText)}`,
              `DESCRIPTION:${escapeIcsText(
                [
                  erinnerungText,
                  `Termin: ${datum.split("-").reverse().join(".")}`,
                  `Rechnung: ${row.invoice_number}`,
                ].join("\\n"),
              )}`,
              "END:VEVENT",
            ].join("\r\n");

            return [termin, erinnerung];
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
