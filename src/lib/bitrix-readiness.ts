import type { Sql } from "./db.ts";
import { isBookingOwner } from "./booking-owner.ts";
import { bitrixCalendarEnabled } from "./bitrix-calendar.ts";

const SHOP = "white-gloss";

export type ReadinessStatus = "ok" | "warn" | "fail";
export type ReadinessCheck = { id: string; label: string; status: ReadinessStatus; detail: string };

type Options = {
  env?: NodeJS.ProcessEnv;
  apiKey: string;
  probe: (key: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * Read-only prerequisites for BOOKING_OPERATIONS=bitrix. Never writes to the
 * database or to Bitrix24; the probe only lists one deal. Expects the Bitrix
 * schema (ensureBitrixSchema) to exist.
 */
export async function bitrixCutoverReadiness(
  sql: Sql,
  options: Options,
): Promise<ReadinessCheck[]> {
  const env = options.env ?? process.env;
  const checks: ReadinessCheck[] = [];
  const mode = env.BOOKING_OPERATIONS?.trim() || "gemischt (alt)";
  checks.push({
    id: "mode",
    label: "Betriebsart",
    status: mode === "bitrix" ? "ok" : "warn",
    detail:
      mode === "bitrix"
        ? "Bitrix24 ist das alleinige System."
        : `Aktuell „${mode}“. Umschaltung per BOOKING_OPERATIONS=bitrix auf dem Server.`,
  });

  if (!options.apiKey) {
    checks.push({
      id: "access",
      label: "Bitrix-Zugang",
      status: "fail",
      detail: "Kein Bitrix-Schlüssel hinterlegt. Bitte oben speichern.",
    });
  } else {
    const probe = await options.probe(options.apiKey).catch(() => ({
      ok: false as const,
      error: "Bitrix24 ist gerade nicht erreichbar.",
    }));
    checks.push({
      id: "access",
      label: "Bitrix-Zugang",
      status: probe.ok ? "ok" : "fail",
      detail: probe.ok ? "Schlüssel gültig, Aufträge lesbar." : probe.error,
    });
  }

  checks.push(
    (await bitrixCalendarEnabled(sql))
      ? { id: "calendar", label: "Kalenderabgleich", status: "ok", detail: "Aktiviert." }
      : {
          id: "calendar",
          label: "Kalenderabgleich",
          status: "warn",
          detail: "Nicht aktiviert. Manuelle Bitrix-Termine sperren sonst keine Zeiten.",
        },
  );

  const users = await sql<{ id: string; email: string | null; emailVerified: boolean }>`
    select id,email,"emailVerified" from "user"`;
  const owner = users.some((user) => isBookingOwner(user, env));
  checks.push({
    id: "owner",
    label: "Inhaberkonto",
    status: owner ? "ok" : "fail",
    detail: owner
      ? "Ein verifiziertes Inhaberkonto kann Aufträge freigeben."
      : "Kein verifiziertes Inhaberkonto gefunden. Freigaben aus der Bitrix-App würden abgewiesen.",
  });

  const mail = Boolean(env.RESEND_API_KEY?.trim() && env.MAIL_FROM?.trim());
  checks.push({
    id: "mail",
    label: "E-Mail-Versand",
    status: mail ? "ok" : "fail",
    detail: mail
      ? "Versand für Bestätigungen und Rechnungen konfiguriert."
      : "RESEND_API_KEY oder MAIL_FROM fehlt. Bestätigungen und Rechnungen blieben liegen.",
  });

  const [queue] = await sql<{ count: number }>`select count(*)::integer as count
    from bitrix_sync_queue where shop_id=${SHOP} and status in ('failed','review')`;
  checks.push({
    id: "queue",
    label: "Bitrix-Übertragungen",
    status: queue.count ? "warn" : "ok",
    detail: queue.count
      ? `${queue.count} Übertragung(en) fehlgeschlagen oder prüfpflichtig. Bitte unten prüfen.`
      : "Keine offenen Fehler.",
  });

  const [open] = await sql<{ count: number }>`
    select count(*)::integer as count from bookings b
    where b.shop_id=${SHOP} and b.status in ('neu','bestaetigt')
      and not exists (
        select 1 from bitrix_sync_queue q
        where q.booking_id=b.id and q.bitrix_deal_id is not null
      )`;
  checks.push({
    id: "open",
    label: "Offene Aufträge ohne Bitrix",
    status: open.count ? "warn" : "ok",
    detail: open.count
      ? `${open.count} offene Buchung(en) ohne Bitrix-Auftrag, etwa aus RO. Vor der Umschaltung abschließen oder übertragen.`
      : "Alle offenen Buchungen haben einen Bitrix-Auftrag.",
  });

  return checks;
}
