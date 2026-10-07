import test from "node:test";
import assert from "node:assert/strict";
import { panelCalendarChunks, panelCalendarBusyWindows, panelBusyWindows } from "./panel-calendar.ts";

const openDay = () => ({
  timeZone: "Europe/Berlin", from: "2099-12-01", to: "2099-12-02", duration: 15,
  days: [{ day: "2099-12-01", weekend: false, closed: false, available: true,
    windows: [{ start: "2099-12-01T07:30:00.000Z", end: "2099-12-01T17:00:00.000Z" }],
    busy: [], free: [{ start: "2099-12-01T07:30:00.000Z", end: "2099-12-01T17:00:00.000Z" }],
  }],
});

test("website inclusive days become bounded exclusive panel chunks, including all 93 allowed days", () => {
  assert.deepEqual(panelCalendarChunks("2099-12-01", "2099-12-01"), [{ from: "2099-12-01", to: "2099-12-02" }]);
  assert.deepEqual(panelCalendarChunks("2026-10-01", "2027-01-01"), [
    { from: "2026-10-01", to: "2026-11-01" }, { from: "2026-11-01", to: "2026-12-02" }, { from: "2026-12-02", to: "2027-01-02" },
  ]);
  for (const [from, to] of [["2026-02-30", "2026-03-01"], ["2026-10-01", "2027-01-02"], ["2026-10-02", "2026-10-01"]]) assert.throws(() => panelCalendarChunks(from, to), /invalid_range/);
});

test("outside 08:30�18:00 is blocked for both existing website resources", () => {
  assert.deepEqual(panelCalendarBusyWindows(openDay(), "2099-12-01", "2099-12-02"), [
    { start: "2099-11-30T23:00:00.000Z", end: "2099-12-01T07:30:00.000Z", resourceId: 1 },
    { start: "2099-11-30T23:00:00.000Z", end: "2099-12-01T07:30:00.000Z", resourceId: 2 },
    { start: "2099-12-01T17:00:00.000Z", end: "2099-12-01T23:00:00.000Z", resourceId: 1 },
    { start: "2099-12-01T17:00:00.000Z", end: "2099-12-01T23:00:00.000Z", resourceId: 2 },
  ]);
});

test("manual occupied time remains blocked while private labels and IDs never cross the bridge", () => {
  const payload = openDay();payload.days[0].busy.push({ start: "2099-12-01T09:00:00.000Z", end: "2099-12-01T11:00:00.000Z" });
  payload.days[0].free = [{ start: "2099-12-01T07:30:00.000Z", end: "2099-12-01T09:00:00.000Z" }, { start: "2099-12-01T11:00:00.000Z", end: "2099-12-01T17:00:00.000Z" }];
  const windows = panelCalendarBusyWindows({ ...payload, entries: [{ title: "PRIVATE", note: "PRIVATE", id: "PRIVATE" }] }, payload.from, payload.to);
  assert.deepEqual(windows.filter(window => window.start === "2099-12-01T09:00:00.000Z").map(window => window.resourceId), [1, 2]);assert.ok(!JSON.stringify(windows).includes("PRIVATE"));
});

test("closed weekend DST days have 23 or 25 real hours, rather than a fixed 24-hour range", () => {
  for (const [day, after, start, end, hours] of [
    ["2026-03-29", "2026-03-30", "2026-03-28T23:00:00.000Z", "2026-03-29T22:00:00.000Z", 23],
    ["2026-10-25", "2026-10-26", "2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z", 25],
  ] as const) {
    const windows = panelCalendarBusyWindows({ timeZone: "Europe/Berlin", from: day, to: after, days: [{ day, weekend: true, closed: true, available: false, windows: [], busy: [], free: [] }] }, day, after);
    assert.equal(windows[0].start, start);assert.equal(windows[0].end, end);assert.equal((Date.parse(end) - Date.parse(start)) / 3_600_000, hours);assert.equal(windows.length, 2);
  }
});

test("explicit weekend windows permit only the released interval and the complete duration must fit", () => {
  const from = "2099-12-05", to = "2099-12-06", free = [{ start: "2099-12-05T09:00:00.000Z", end: "2099-12-05T11:00:00.000Z" }];
  const windows = panelCalendarBusyWindows({ timeZone: "Europe/Berlin", from, to, days: [{ day: from, weekend: true, closed: false, available: true, windows: free, free, busy: [] }] }, from, to);
  const busy = (start: string, minutes: number) => [1, 2].every(resource => windows.some(window => window.resourceId === resource && Date.parse(window.start) < Date.parse(start) + minutes * 60_000 && Date.parse(window.end) > Date.parse(start)));
  assert.equal(busy("2099-12-05T09:00:00Z", 120), false);assert.equal(busy("2099-12-05T09:00:00Z", 121), true);assert.equal(busy("2099-12-05T08:59:00Z", 15), true);
});

test("malformed, partial or contradictory availability fails closed", () => {
  const cases: unknown[] = [null, { ...openDay(), timeZone: "UTC" }, { ...openDay(), from: "2099-12-02" }, { ...openDay(), days: [] }];
  const overlapping = openDay();overlapping.days[0].free.push({ ...overlapping.days[0].free[0] });cases.push(overlapping);
  const contradiction = openDay();contradiction.days[0].busy.push({ start: "2099-12-01T09:00:00Z", end: "2099-12-01T10:00:00Z" });cases.push(contradiction);
  const outside = openDay();outside.days[0].free[0].end = "2099-12-01T18:00:00Z";cases.push(outside);
  const local = openDay();local.days[0].free[0].start = "2099-12-01T08:30";cases.push(local);
  const closed = openDay();closed.days[0].closed = true;cases.push(closed);
  const seconds = openDay();seconds.days[0].windows[0].end = "2099-12-01T17:00:01.000Z";cases.push(seconds);
  for (const payload of cases) assert.throws(() => panelCalendarBusyWindows(payload, "2099-12-01", "2099-12-02"), /panel_calendar_unavailable/);
});

test("fetch uses only the fixed HTTPS panel, no credentials or redirects, and validates the reply", async () => {
  let calls = 0;
  const result = await panelBusyWindows("2099-12-01", "2099-12-01", async (url, init) => {
    calls++;const target = new URL(String(url));assert.equal(target.origin, "https://panel.white-gloss.de");assert.equal(target.pathname, "/api/calendar/availability");assert.equal(target.searchParams.get("from"), "2099-12-01");assert.equal(target.searchParams.get("to"), "2099-12-02");assert.equal(init?.credentials, "omit");assert.equal(init?.redirect, "error");assert.equal(init?.cache, "no-store");assert.ok(init?.signal);
    return Response.json(openDay());
  });assert.equal(calls, 1);assert.equal(result.length, 4);
});

test("unavailable, invalid JSON and oversized responses cannot advertise free slots", async () => {
  const responses = [new Response("unavailable", { status: 503 }), new Response("{}", { headers: { "Content-Type": "text/html" } }), new Response("not json", { headers: { "Content-Type": "application/json" } }), new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "2000000" } }), new Response("x".repeat(1_048_577), { headers: { "Content-Type": "application/json" } })];
  for (const response of responses) await assert.rejects(panelBusyWindows("2099-12-01", "2099-12-01", async () => response), /panel_calendar_unavailable/);
  await assert.rejects(panelBusyWindows("2099-12-01", "2099-12-01", async () => { throw new Error("TEST network failure"); }), /TEST network failure/);
});
