import type { Sql } from "./db.ts";
import { isBookingOwner } from "./booking-owner.ts";

const SHOP = "white-gloss";

export type ReadinessStatus = "ok" | "warn" | "fail";
export type ReadinessCheck = { id: string; label: string; status: ReadinessStatus; detail: string };

type Probe = (key: string) => Promise<{ ok: true } | { ok: false; error: string }>;
type Options = {
  env?: NodeJS.ProcessEnv;
  apiKey: string;
  probe: Probe;
  /** Reads the workshop calendar with the current key; throws when that is not possible. */
  calendarProbe: (key: string) => Promise<unknown>;
};

async function tableExists(sql: Sql, name: string) {
  const [row] = await sql<{ name: string | null }>`select to_regclass(${name})::text as name`;
  return Boolean(row?.name);
}

async function columnExists(sql: Sql, table: string, column: string) {
  const rows = await sql`select 1 from information_schema.columns
    where table_schema=current_schema() and table_name=${table} and column_name=${column}`;
  return rows.length > 0;
}

/**
 * Read-only prerequisites for BOOKING_OPERATIONS=bitrix. Issues only SELECTs
 * (no DDL, no inserts) and read-only Bitrix24 requests: one deal and the
 * workshop calendar of the next days.
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
    status: mode === "bitrix" ? "ok" : "fail",
    detail:
      mode === "bitrix"
        ? "Bitrix24 ist das alleinige System."
        : `Aktuell „${mode}“. Umschaltung per BOOKING_OPERATIONS=bitrix auf dem Server.`,
  });

  let accessOk = false;
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
    accessOk = probe.ok;
    checks.push({
      id: "access",
      label: "Bitrix-Zugang",
      status: probe.ok ? "ok" : "fail",
      detail: probe.ok ? "Schlüssel gültig, Aufträge lesbar." : probe.error,
    });
  }

  const calendarFlag =
    (await columnExists(sql, "shop_settings", "bitrix_calendar_enabled")) &&
    (
      await sql<{ enabled: boolean }>`select bitrix_calendar_enabled as enabled
        from shop_settings where shop_id=${SHOP}`
    )[0]?.enabled === true;
  if (!calendarFlag) {
    checks.push({
      id: "calendar",
      label: "Kalenderabgleich",
      status: "fail",
      detail: "Nicht aktiviert. Manuelle Bitrix-Termine sperren sonst keine Zeiten.",
    });
  } else if (!accessOk) {
    checks.push({
      id: "calendar",
      label: "Kalenderabgleich",
      status: "fail",
      detail: "Aktiviert, aber ohne funktionierenden Bitrix-Zugang nicht lesbar.",
    });
  } else {
    const error = await options
      .calendarProbe(options.apiKey)
      .then(() => null)
      .catch((cause: unknown) =>
        cause instanceof Error ? cause.message : "Kalender nicht lesbar.",
      );
    checks.push({
      id: "calendar",
      label: "Kalenderabgleich",
      status: error ? "fail" : "ok",
      detail: error
        ? `Aktiviert, aber mit dem aktuellen Zugang nicht lesbar: ${error}`
        : "Aktiviert und mit dem aktuellen Zugang lesbar.",
    });
  }

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

  // Presence only: delivery itself is proven by the first test order (protocol A/C).
  const mail = Boolean(env.RESEND_API_KEY?.trim() && env.MAIL_FROM?.trim());
  checks.push({
    id: "mail",
    label: "E-Mail-Versand",
    status: mail ? "warn" : "fail",
    detail: mail
      ? "Zugangsdaten vorhanden, Zustellung aber nicht geprüft. Mit dem ersten Testauftrag nachweisen."
      : "RESEND_API_KEY oder MAIL_FROM fehlt. Bestätigungen und Rechnungen blieben liegen.",
  });

  const queueExists = await tableExists(sql, "bitrix_sync_queue");
  if (!queueExists) {
    checks.push({
      id: "queue",
      label: "Bitrix-Übertragungen",
      status: "fail",
      detail: "Noch keine Übertragung gelaufen. Nach dem Speichern des Schlüssels erneut prüfen.",
    });
  } else {
    const [queue] = await sql<{ blocked: number; retrying: number; waiting: number }>`
      select count(*) filter (where status in ('failed','review'))::integer as blocked,
        count(*) filter (where status='pending' and last_error is not null)::integer as retrying,
        count(*) filter (where status='pending' and last_error is null)::integer as waiting
      from bitrix_sync_queue where shop_id=${SHOP}`;
    const problems = [
      queue.blocked ? `${queue.blocked} fehlgeschlagen oder prüfpflichtig` : "",
      queue.retrying ? `${queue.retrying} mit Fehler in Wiederholung` : "",
    ].filter(Boolean);
    checks.push({
      id: "queue",
      label: "Bitrix-Übertragungen",
      status: problems.length || queue.waiting ? "fail" : "ok",
      detail: problems.length
        ? `${problems.join(", ")}. Bitte unten prüfen.`
        : queue.waiting
          ? `Keine Fehler, ${queue.waiting} wartet auf Übertragung.`
          : "Keine offenen Fehler.",
    });
  }

  const [open] = queueExists
    ? await sql<{ count: number }>`
        select count(*)::integer as count from bookings b
        where b.shop_id=${SHOP} and b.status in ('neu','bestaetigt')
          and not exists (
            select 1 from bitrix_sync_queue q
            where q.booking_id=b.id and q.shop_id=b.shop_id and q.bitrix_deal_id > 0 and q.status='synced'
          )`
    : await sql<{ count: number }>`select count(*)::integer as count from bookings
        where shop_id=${SHOP} and status in ('neu','bestaetigt')`;
  checks.push({
    id: "open",
    label: "Offene Aufträge ohne Bitrix",
    status: open.count ? "fail" : "ok",
    detail: open.count
      ? `${open.count} offene Buchung(en) ohne Bitrix-Auftrag, etwa aus RO. Vor der Umschaltung abschließen oder übertragen.`
      : "Alle offenen Buchungen sind erfolgreich nach Bitrix übertragen.",
  });

  return checks;
}
