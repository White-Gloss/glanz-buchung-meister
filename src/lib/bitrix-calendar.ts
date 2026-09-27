import { createHash } from "node:crypto";
import type { Sql } from "./db.ts";
import { readBitrixWebhook } from "./bitrix-credentials.server.ts";
import { normalizeBitrixRestWebhook, restCall } from "./bitrix-rest.ts";
import { berlinWallToUtc, rangesOverlap } from "./booking-time.ts";

export type BusyWindow = { start: string; end: string; resourceId: number };
type EventWindow = BusyWindow & { eventId: number };
type CalendarEvent = {
  id: number;
  sectionId: number;
  from: string;
  to: string;
  skipTime?: boolean;
  durationSeconds?: number;
  active?: boolean;
  deleted?: boolean;
  accessibility?: string;
  occurrenceIndex?: number;
};

const SHOP = "white-gloss";
const failure = () =>
  new Error(
    "Bitrix-Kalender konnte nicht vollständig geprüft werden. Bitte erneut versuchen; der Termin wurde nicht freigegeben.",
  );

export async function ensureBitrixCalendarSchema(sql: Sql) {
  await sql`alter table shop_settings add column if not exists bitrix_calendar_enabled boolean not null default false`;
}

export async function bitrixCalendarEnabled(sql: Sql) {
  await ensureBitrixCalendarSchema(sql);
  const [row] = await sql<{
    enabled: boolean;
  }>`select bitrix_calendar_enabled as enabled from shop_settings where shop_id=${SHOP}`;
  return row?.enabled === true;
}

/** Half-open Berlin days, including DST changes; public responses contain no event titles. */
export function calendarDateRange(from: string, to: string) {
  const valid = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  if (
    !valid(from) ||
    !valid(to) ||
    to < from ||
    Date.parse(to) - Date.parse(from) > 92 * 86_400_000
  )
    throw new Error("Bitte einen gültigen Zeitraum von höchstens 93 Tagen auswählen.");
  const following = new Date(Date.parse(to) + 86_400_000).toISOString().slice(0, 10);
  return {
    from: berlinWallToUtc(from, "00:00").toISOString(),
    to: berlinWallToUtc(following, "00:00").toISOString(),
  };
}

export function publicAvailabilityDateRange(
  from: string,
  to: string,
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }),
) {
  const last = new Date(Date.parse(today) + 92 * 86_400_000).toISOString().slice(0, 10);
  if (from < today || to > last)
    throw new Error("Bitte nur Zeiträume innerhalb der nächsten 93 Tage auswählen.");
  return calendarDateRange(from, to);
}

export function eventWindows(events: CalendarEvent[]): EventWindow[] {
  return events.flatMap((event) => {
    if (!event || !Number.isInteger(event.sectionId)) throw failure();
    // The existing shared workshop calendar is section 2. Manual blocks occupy
    // both capacities; website exports are deduplicated by exact stored ID/range below.
    if (
      event.sectionId !== 2 ||
      event.deleted === true ||
      event.active === false ||
      event.accessibility === "free"
    )
      return [];
    if (!Number.isInteger(event.id) || event.id <= 0) throw failure();
    let start: Date, end: Date;
    if (event.skipTime) {
      const day = event.from?.slice(0, 10);
      if (
        event.durationSeconds != null &&
        (!Number.isFinite(event.durationSeconds) || event.durationSeconds <= 0)
      )
        throw failure();
      const days = Math.max(1, Math.ceil((event.durationSeconds ?? 86_400) / 86_400));
      if (!Number.isFinite(days) || days > 366) throw failure();
      const lastDay = new Date(Date.parse(day) + (days - 1) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const range = calendarDateRange(day, lastDay);
      start = new Date(range.from);
      end = new Date(range.to);
    } else {
      if (
        !/(Z|[+-]\d{2}:\d{2})$/.test(event.from || "") ||
        !/(Z|[+-]\d{2}:\d{2})$/.test(event.to || "")
      )
        throw failure();
      start = new Date(event.from);
      end = new Date(event.to);
    }
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
      throw failure();
    return [1, 2].map((resourceId) => ({
      eventId: event.id,
      resourceId,
      start: start.toISOString(),
      end: end.toISOString(),
    }));
  });
}

function nativeWallDate(value: unknown) {
  if (typeof value !== "string") throw failure();
  const german = /^(\d{2})\.(\d{2})\.(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (!german && !iso) throw failure();
  const day = german
    ? `${german[3]}-${german[2]}-${german[1]}`
    : `${iso![1]}-${iso![2]}-${iso![3]}`;
  const parts = german || iso!;
  const time = `${parts[4] || "00"}:${parts[5] || "00"}:${parts[6] || "00"}`;
  const wall = `${day} ${time}`;
  const utc = new Date(`${day}T${time}Z`);
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 19).replace("T", " ") !== wall)
    throw failure();
  return { day, wall, utc };
}

function nativeInstant(value: unknown, offsetValue: unknown, zone: unknown) {
  const { wall, utc } = nativeWallDate(value);
  if (
    offsetValue === null ||
    offsetValue === undefined ||
    offsetValue === "" ||
    typeof zone !== "string" ||
    !zone
  )
    throw failure();
  const offset = Number(offsetValue);
  if (!Number.isInteger(offset) || Math.abs(offset) > 50400) throw failure();
  const date = new Date(utc.getTime() - offset * 1000);
  try {
    const rendered = date.toLocaleString("sv-SE", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    if (rendered !== wall) throw failure();
  } catch {
    throw failure();
  }
  return date.toISOString();
}

export async function readBitrixCalendar(
  key: string,
  from: string,
  to: string,
  fetchImpl: typeof fetch = fetch,
): Promise<EventWindow[]> {
  const webhook = normalizeBitrixRestWebhook(key);
  if (!webhook) throw failure();
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const rows = await restCall(
    webhook,
    "calendar.event.get",
    {
      type: "user",
      ownerId: 1,
      section: [2],
      from: day(from),
      to: day(to),
    },
    fetchImpl,
  ).catch(() => {
    throw failure();
  });
  if (!Array.isArray(rows)) throw failure();
  const events: CalendarEvent[] = rows.map((row: Record<string, unknown>) => {
    if (!row || typeof row !== "object") throw failure();
    const sectionId = Number(row.SECTION_ID ?? row.SECT_ID);
    const id = Number(row.ID);
    const skipTime = row.DT_SKIP_TIME === "Y";
    const ignored = row.DELETED === "Y" || row.ACCESSIBILITY === "free" || sectionId !== 2;
    // Never advertise a free slot from an unexpanded recurrence rule.
    if (
      !ignored &&
      row.RRULE &&
      typeof row.RRULE === "object" &&
      "FREQ" in row.RRULE &&
      !row.RECURRENCE_ID
    )
      throw failure();
    // Live portal 25 Sep 2026: DATE_FROM=11:00 Europe/Berlin, offset=7200,
    // but DATE_FROM_TS_UTC resolves to 06:00Z. Use the actual wall time and
    // verify its explicit offset against the named timezone instead.
    const start = ignored
      ? ""
      : skipTime
        ? nativeWallDate(row.DATE_FROM).day
        : nativeInstant(row.DATE_FROM, row.TZ_OFFSET_FROM, row.TZ_FROM);
    const end = ignored || skipTime ? "" : nativeInstant(row.DATE_TO, row.TZ_OFFSET_TO, row.TZ_TO);
    return {
      id,
      sectionId,
      deleted: row.DELETED === "Y",
      accessibility: String(row.ACCESSIBILITY || "busy"),
      from: start,
      to: end,
      skipTime,
      durationSeconds: skipTime ? Number(row.DT_LENGTH) : undefined,
    };
  });
  return eventWindows(events);
}

const cache = new Map<string, { until: number; promise: Promise<EventWindow[]> }>();

export async function bitrixBusyWindows(
  sql: Sql,
  from: string,
  to: string,
  options: {
    fresh?: boolean;
    force?: boolean;
    nativeOnly?: boolean;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<BusyWindow[]> {
  if (!options.force && !(await bitrixCalendarEnabled(sql))) return [];
  const key = await readBitrixWebhook(sql);
  const cacheKey = createHash("sha256").update(`${key}:${from}:${to}`).digest("hex");
  let entry = options.fresh ? undefined : cache.get(cacheKey);
  if (!entry || entry.until <= Date.now()) {
    const promise = readBitrixCalendar(key, from, to, options.fetchImpl);
    entry = { until: Date.now() + 30_000, promise };
    if (!options.fresh) {
      if (cache.size >= 20) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, entry);
    }
  }
  const events = await entry.promise;
  if (options.nativeOnly)
    return events.map(({ start, end, resourceId }) => ({ start, end, resourceId }));
  const exported = await sql<{
    bitrix_event_id: number;
    work_start_at: Date | string;
    work_end_at: Date | string;
  }>`
    select bitrix_event_id, work_start_at, work_end_at from bookings
    where shop_id=${SHOP} and bitrix_event_id is not null
      and work_start_at is not null and work_end_at is not null
      and status in ('bestaetigt','erledigt','nicht_erschienen')
      and work_start_at < ${to}::timestamptz
      and work_end_at > ${from}::timestamptz`;
  return events
    .filter(
      (event) =>
        !exported.some(
          (row) =>
            row.bitrix_event_id === event.eventId &&
            new Date(row.work_start_at).toISOString() === event.start &&
            new Date(row.work_end_at).toISOString() === event.end,
        ),
    )
    .map(({ start, end, resourceId }) => ({ start, end, resourceId }));
}

export async function assertBitrixCalendarAvailable(
  sql: Sql,
  start: Date,
  end: Date,
  resourceId: number,
) {
  const windows = await bitrixBusyWindows(sql, start.toISOString(), end.toISOString(), {
    fresh: true,
  });
  if (
    windows.some(
      (window) =>
        window.resourceId === resourceId &&
        rangesOverlap(start, end, new Date(window.start), new Date(window.end)),
    )
  )
    throw new Error(
      "Terminkonflikt: Der Zeitraum ist im Bitrix-Kalender gesperrt. Bitte einen anderen Zeitraum wählen.",
    );
}
