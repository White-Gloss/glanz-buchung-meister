import test from "node:test";
import assert from "node:assert/strict";
import { readRoCalendar } from "./roapp-calendar.ts";
import type { RoappRequest } from "./roapp.ts";

const statuses = [
  { id: 1, group: { type: 2 } },
  { id: 2, group: { type: 4 } },
  { id: 3, group: { type: 3 } },
];
const order = (id: number, overrides = {}) => ({
  id,
  branch_id: 10,
  status: { id: 1, name: "In Arbeit" },
  scheduled_for: "2026-10-23T07:00:00Z",
  scheduled_to: "2026-10-26T16:00:00Z",
  ...overrides,
});
function transport(pages: unknown[][]): RoappRequest {
  return (async (_method, path, _body, query) =>
    path.endsWith("statuses")
      ? statuses
      : {
          data: pages[Number(query?.page) - 1],
          paging: {
            page: Number(query?.page),
            total_pages: pages.length,
            count: pages.flat().length,
          },
        }) as RoappRequest;
}
test("reads every page and preserves multi-day/DST intervals, releasing completed/rejected orders", async () => {
  const result = await readRoCalendar(
    transport([
      [order(1), order(2, { status: { id: 2, name: "Erledigt" } })],
      [
        order(3, { status: { id: 3, name: "Abgelehnt" } }),
        order(4, { branch_id: 11 }),
        order(5, { scheduled_for: null, scheduled_to: null }),
        order(6, { scheduled_for: "2026-11-01T08:00:00Z", scheduled_to: "2026-11-01T10:00:00Z" }),
      ],
    ]),
    10,
  );
  assert.deepEqual(result, [
    { start: "2026-10-23T07:00:00.000Z", end: "2026-10-26T16:00:00.000Z", resourceId: 1 },
    { start: "2026-11-01T08:00:00.000Z", end: "2026-11-01T10:00:00.000Z", resourceId: 1 },
  ]);
  assert.equal(JSON.stringify(result).includes('"id"'), false);
});
test("does not advertise free capacity from incomplete or invalid provider data", async () => {
  for (const rows of [
    [order(1, { scheduled_to: null })],
    [order(1, { status: { id: 99, name: "Unknown" } })],
    [order(1), order(1)],
  ])
    await assert.rejects(readRoCalendar(transport([rows]), 10), /roapp_calendar_/);
  await assert.rejects(readRoCalendar((async () => ({})) as RoappRequest, 10));
  const incomplete = (async (_method: string, path: string) =>
    path.endsWith("statuses")
      ? statuses
      : {
          data: [],
          paging: { page: 1, total_pages: 1, count: 1 },
        }) as RoappRequest;
  await assert.rejects(readRoCalendar(incomplete, 10), /incomplete/);
});
