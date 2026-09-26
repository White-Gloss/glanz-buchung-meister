import { createRoappClient, roappCredentialsFromEnv, type RoappRequest } from "./roapp.ts";

type Window = { start: string; end: string; resourceId: number };
type Order = {
  id: number;
  branch_id: number;
  status: { id: number; name: string };
  scheduled_for: string | null;
  scheduled_to: string | null;
};

/** Read all pages, including orders beginning before the requested range.
 * A partial or malformed calendar must never be presented as free capacity. */
export async function readRoCalendar(request: RoappRequest, branchId: number): Promise<Window[]> {
  const statuses = await request<{ id: number; group: { type: number } }[]>(
    "GET",
    "/orders/statuses",
  );
  if (!Array.isArray(statuses) || !statuses.length) throw new Error("roapp_calendar_statuses");
  const groups = new Map(statuses.map((status) => [status.id, status.group?.type]));
  const windows: Window[] = [];
  const seen = new Set<number>();
  let expectedPages: number | undefined;
  for (let page = 1; page <= 100; page++) {
    const result = await request<{
      data: Order[];
      paging: { page: number; total_pages: number; count: number };
    }>("GET", "/orders", null, { page: String(page), branch_ids: [String(branchId)], sort: "id" });
    const pages = result?.paging?.total_pages;
    if (
      !Array.isArray(result?.data) ||
      result.paging.page !== page ||
      !Number.isSafeInteger(pages) ||
      pages < 0 ||
      pages > 100 ||
      (expectedPages !== undefined && expectedPages !== pages)
    ) {
      throw new Error("roapp_calendar_incomplete");
    }
    expectedPages = pages;
    for (const order of result.data) {
      if (!Number.isSafeInteger(order.id) || seen.has(order.id))
        throw new Error("roapp_calendar_incomplete");
      seen.add(order.id);
      if (order.branch_id !== branchId) continue;
      const group = groups.get(order.status?.id);
      if (!group) throw new Error("roapp_calendar_unknown_status");
      // Finished/closed/rejected orders release capacity. Some tenants keep a
      // rejected status in the pending group, so also honor its explicit name.
      if (
        [4, 6, 7].includes(group) ||
        /abgelehnt|storniert|rejected|cancelled|canceled/i.test(order.status.name)
      )
        continue;
      if (!order.scheduled_for && !order.scheduled_to) continue;
      const start = Date.parse(order.scheduled_for || "");
      const end = Date.parse(order.scheduled_to || "");
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        throw new Error("roapp_calendar_invalid_interval");
      windows.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        resourceId: 1,
      });
    }
    if (page >= pages) {
      if (seen.size !== result.paging.count) throw new Error("roapp_calendar_incomplete");
      return windows;
    }
  }
  throw new Error("roapp_calendar_incomplete");
}

// Share concurrent reads and cache only successful snapshots, for at most 30s.
// The cache contains no names, contact data, amounts, or order identifiers.
let snapshot: { windows: Window[]; until: number } | undefined;
let pending: Promise<Window[]> | undefined;
export async function roappBusyWindows(from: string, to: string): Promise<Window[]> {
  if (!snapshot || snapshot.until <= Date.now()) {
    if (!pending) {
      const credentials = roappCredentialsFromEnv();
      if (!credentials) throw new Error("roapp_calendar_not_configured");
      pending = readRoCalendar(
        createRoappClient(credentials, { maxRetries: 1 }),
        credentials.branchId,
      )
        .then((windows) => {
          snapshot = { windows, until: Date.now() + 30_000 };
          return windows;
        })
        .finally(() => {
          pending = undefined;
        });
    }
    await pending;
  }
  return snapshot!.windows.filter((window) => window.start < to && window.end > from);
}
