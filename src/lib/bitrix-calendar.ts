import { createHash } from "node:crypto";
import type { Sql } from "./db.ts";
import { readVibeApiKey } from "./bitrix-credentials.server.ts";
import { normalizeBitrixRestWebhook, vibeApiBase } from "./bitrix.ts";
import { berlinWallToUtc, rangesOverlap } from "./zoho-time.ts";

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

export async function readBitrixCalendar(
  key: string,
  from: string,
  to: string,
  fetchImpl: typeof fetch = fetch,
): Promise<EventWindow[]> {
  if (!key || normalizeBitrixRestWebhook(key))
    throw new Error(
      "Für den Kalenderabgleich wird der persönliche VibeCode-Zugang mit Kalenderrecht benötigt.",
    );
  const events: CalendarEvent[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  for (let page = 0; page < 10; page++) {
    const response = await fetchImpl(`${vibeApiBase()}/calendar-events/search`, {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: { type: "user", ownerId: 1, section: 2, from, to },
        limit: 500,
        offset: events.length,
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => {
      throw failure();
    });
    if (!response.ok) throw failure();
    const result = await response.json().catch(() => {
      throw failure();
    });
    if (
      result.success !== true ||
      !Array.isArray(result.data) ||
      typeof result.meta?.hasMore !== "boolean" ||
      !Number.isInteger(result.meta.total)
    )
      throw failure();
    if (total !== undefined && total !== result.meta.total) throw failure();
    total = result.meta.total;
    for (const event of result.data as CalendarEvent[]) {
      const identity = `${event.id}:${event.occurrenceIndex ?? 0}:${event.from}`;
      if (seen.has(identity)) throw failure();
      seen.add(identity);
      events.push(event);
    }
    if (!result.meta.hasMore) {
      if (events.length !== total) throw failure();
      return eventWindows(events);
    }
    if (!result.data.length) throw failure();
  }
  throw failure();
}

const cache = new Map<string, { until: number; promise: Promise<EventWindow[]> }>();

export async function bitrixBusyWindows(
  sql: Sql,
  from: string,
  to: string,
  options: { fresh?: boolean; force?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<BusyWindow[]> {
  if (!options.force && !(await bitrixCalendarEnabled(sql))) return [];
  const key = await readVibeApiKey(sql);
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
  const exported = await sql<{
    bitrix_event_id: number;
    work_start_at: Date | string;
    work_end_at: Date | string;
  }>`
    select bitrix_event_id, work_start_at, work_end_at from bookings
    where shop_id=${SHOP} and bitrix_event_id is not null
      and work_start_at is not null and work_end_at is not null
      and status in ('bestaetigt','erledigt','nicht_erschienen')`;
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
