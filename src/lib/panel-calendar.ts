/** Read-only bridge: panel capacity becomes the existing anonymous busy-window format. */
export type PanelBusyWindow = { start: string; end: string; resourceId: 1 | 2 };
type PanelRange = { from: string; to: string };
type PanelInterval = { start: string; end: string };
const PANEL_CALENDAR_ORIGIN = "https://panel.white-gloss.de";
const PANEL_ZONE = "Europe/Berlin";
const PANEL_MAX_BODY_BYTES = 1_048_576;
const panelDateParts = new Intl.DateTimeFormat("sv-SE", {
  timeZone: PANEL_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const panelFailure = () => new Error("panel_calendar_unavailable");

function panelValidDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
function panelAddDays(day: string, count: number): string {
  return new Date(Date.parse(day + "T12:00:00Z") + count * 86_400_000).toISOString().slice(0, 10);
}
function panelRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function panelWallStamp(value: string): string {
  return panelDateParts.format(new Date(value)).replace(" ", "T");
}
function panelWallInstant(day: string, time: string): string {
  const wanted = day + "T" + time, base = Date.parse(wanted + "Z");
  const matches = [60, 120].map(offset => new Date(base - offset * 60_000).toISOString())
    .filter(instant => panelWallStamp(instant) === wanted);
  if (matches.length !== 1) throw panelFailure();
  return matches[0];
}
function panelMidnight(day: string): string { return panelWallInstant(day, "00:00"); }
function panelValidInstant(value: string): boolean {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-](\d{2}):(\d{2}))$/);
  return Boolean(match && panelValidDay(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4] ?? 0) < 60 && Number(match[6] ?? 0) < 24 && Number(match[7] ?? 0) < 60 && Number.isFinite(Date.parse(value)));
}
function panelIntervals(value: unknown, day: string, confined: boolean): PanelInterval[] {
  if (!Array.isArray(value) || value.length > 20_000) throw panelFailure();
  const dayStart = Date.parse(panelMidnight(day)), dayEnd = Date.parse(panelMidnight(panelAddDays(day, 1)));
  return value.map(input => {
    if (!panelRecord(input) || typeof input.start !== "string" || typeof input.end !== "string") throw panelFailure();
    if (!panelValidInstant(input.start) || !panelValidInstant(input.end)) throw panelFailure();
    const start = Date.parse(input.start), end = Date.parse(input.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start >= dayEnd || end <= dayStart) throw panelFailure();
    if (confined) {
      const localStart = panelWallStamp(input.start), localEnd = panelWallStamp(input.end);
      if (localStart.slice(0, 10) !== day || localEnd.slice(0, 10) !== day ||
          start < Date.parse(panelWallInstant(day, "08:30")) || end > Date.parse(panelWallInstant(day, "18:00"))) throw panelFailure();
    }
    return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
  });
}
function panelDisjoint(intervals: PanelInterval[]): boolean {
  return intervals.every((interval, index) => index === 0 || Date.parse(intervals[index - 1].end) <= Date.parse(interval.start));
}

/** Website dates are inclusive; the panel accepts an exclusive upper day, at most 31 per read. */
export function panelCalendarChunks(from: string, to: string): PanelRange[] {
  if (!panelValidDay(from) || !panelValidDay(to)) throw new Error("invalid_range");
  const days = (Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86_400_000 + 1;
  if (days < 1 || days > 93) throw new Error("invalid_range");
  const chunks: PanelRange[] = [];
  for (let offset = 0; offset < days; offset += 31)
    chunks.push({ from: panelAddDays(from, offset), to: panelAddDays(from, Math.min(days, offset + 31)) });
  return chunks;
}

/** Reject incomplete/unsafe replies, then block the complement of verified free time for both capacities. */
export function panelCalendarBusyWindows(payload: unknown, from: string, to: string): PanelBusyWindow[] {
  if (!panelValidDay(from) || !panelValidDay(to)) throw panelFailure();
  const count = (Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86_400_000;
  if (count < 1 || count > 31 || !panelRecord(payload) || payload.timeZone !== PANEL_ZONE ||
      payload.from !== from || payload.to !== to || !Array.isArray(payload.days) || payload.days.length !== count) throw panelFailure();
  const blocked: PanelInterval[] = [];
  for (let index = 0; index < count; index += 1) {
    const day = panelAddDays(from, index), input = payload.days[index];
    const weekend = [0, 6].includes(new Date(day + "T12:00:00Z").getUTCDay());
    if (!panelRecord(input) || input.day !== day || typeof input.closed !== "boolean" || input.weekend !== weekend || typeof input.available !== "boolean") throw panelFailure();
    const windows = panelIntervals(input.windows, day, true), free = panelIntervals(input.free, day, true), busy = panelIntervals(input.busy, day, false);
    if (windows.length > 8 || !panelDisjoint(windows) || !panelDisjoint(free) || input.closed !== (windows.length === 0)) throw panelFailure();
    for (const interval of free) {
      if (!windows.some(window => Date.parse(window.start) <= Date.parse(interval.start) && Date.parse(window.end) >= Date.parse(interval.end)) ||
          busy.some(window => Date.parse(window.start) < Date.parse(interval.end) && Date.parse(window.end) > Date.parse(interval.start))) throw panelFailure();
    }
    let cursor = panelMidnight(day);
    for (const interval of free) {
      if (Date.parse(cursor) < Date.parse(interval.start)) blocked.push({ start: cursor, end: interval.start });
      cursor = interval.end;
    }
    const end = panelMidnight(panelAddDays(day, 1));
    if (Date.parse(cursor) < Date.parse(end)) blocked.push({ start: cursor, end });
  }
  const merged: PanelInterval[] = [];
  for (const interval of blocked) {
    const previous = merged[merged.length - 1];
    if (previous && Date.parse(previous.end) === Date.parse(interval.start)) previous.end = interval.end;
    else merged.push({ ...interval });
  }
  return merged.flatMap(interval => [1, 2].map(resourceId => ({ ...interval, resourceId: resourceId as 1 | 2 })));
}

async function panelReply(response: Response): Promise<unknown> {
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json") ||
      Number(response.headers.get("content-length") ?? 0) > PANEL_MAX_BODY_BYTES) throw panelFailure();
  const reader = response.body?.getReader();
  if (!reader) throw panelFailure();
  let total = 0;
  const pieces: Uint8Array[] = [];
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > PANEL_MAX_BODY_BYTES) { await reader.cancel(); throw panelFailure(); }
      pieces.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);let offset = 0;
  for (const piece of pieces) { bytes.set(piece, offset); offset += piece.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw panelFailure(); }
}

export async function panelBusyWindows(from: string, to: string, fetchImpl: typeof fetch = fetch): Promise<PanelBusyWindow[]> {
  const windows: PanelBusyWindow[] = [];
  for (const range of panelCalendarChunks(from, to)) {
    const url = new URL("/api/calendar/availability", PANEL_CALENDAR_ORIGIN);
    url.searchParams.set("from", range.from);url.searchParams.set("to", range.to);url.searchParams.set("duration", "15");
    const response = await fetchImpl(url, { headers: { Accept: "application/json" }, credentials: "omit", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000) });
    windows.push(...panelCalendarBusyWindows(await panelReply(response), range.from, range.to));
  }
  return windows;
}
