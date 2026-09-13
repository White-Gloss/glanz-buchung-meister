import type { Sql } from "./db.ts";
import { createBitrixClient } from "./bitrix.ts";
import { readVibeApiKey } from "./bitrix-credentials.server.ts";
import { berlinWallToUtc } from "./zoho-time.ts";

export function calendarInterval(event: { from?: string; to?: string; skipTime?: boolean }) {
  let start = new Date(event.from || ""),
    end = new Date(event.to || "");
  if (event.skipTime && event.from && event.to) {
    start = berlinWallToUtc(event.from.slice(0, 10), "00:00");
    const nextDay = new Date(`${event.to.slice(0, 10)}T12:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    end = berlinWallToUtc(nextDay.toISOString().slice(0, 10), "00:00");
  }
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    throw new Error("Ein Kalendereintrag hat keinen lesbaren Zeitraum.");
  return { start: start.toISOString(), end: end.toISOString(), resourceId: 1 };
}

export async function externalBitrixBusyWindows(
  sql: Sql,
  from: string,
  to: string,
  ignoreDealId?: number,
) {
  const key = await readVibeApiKey(sql);
  if (!key) return [];
  const request = createBitrixClient(key);
  const events = await request<
    {
      id: number;
      from?: string;
      to?: string;
      accessibility?: string;
      sectionId?: number;
      crmFields?: string[];
      skipTime?: boolean;
      active?: boolean;
      deleted?: boolean;
    }[]
  >(
    "GET",
    `/calendar-events?type=user&ownerId=1&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=5000`,
  );
  const existing = await sql<{
    bitrix_event_id: number;
  }>`select bitrix_event_id from bookings where shop_id='white-gloss' and bitrix_deal_id=${ignoreDealId ?? null} and bitrix_event_id is not null union select bitrix_event_id from bitrix_sync_queue where shop_id='white-gloss' and bitrix_deal_id=${ignoreDealId ?? null} and bitrix_event_id is not null`;
  const ignored = new Set(existing.map((row) => Number(row.bitrix_event_id)));
  return events
    .filter(
      (event) =>
        event.accessibility !== "free" &&
        event.active !== false &&
        !event.deleted &&
        !ignored.has(Number(event.id)) &&
        !(ignoreDealId && event.crmFields?.includes(`D_${ignoreDealId}`)),
    )
    .map((event) => {
      return calendarInterval(event);
    })
    .filter(
      (event) => new Date(event.start) < new Date(to) && new Date(event.end) > new Date(from),
    );
}
