import { createFileRoute } from "@tanstack/react-router";
import { calendarDateRange, bitrixBusyWindows } from "@/lib/bitrix-calendar";

export const Route = createFileRoute("/api/availability")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { assertRateLimit, clientIp } = await import("@/lib/rate-limit");
        try {
          assertRateLimit("availability", clientIp(request), 8, 60_000);
        } catch {
          return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
        }
        const url = new URL(request.url);
        const from = url.searchParams.get("from") || "";
        const to = url.searchParams.get("to") || "";
        const span = Date.parse(to) - Date.parse(from);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
          !Number.isFinite(span) ||
          span < 0 ||
          span > 92 * 86400000
        ) {
          return Response.json({ ok: false, error: "invalid_range" }, { status: 400 });
        }
        try {
          const range = calendarDateRange(from, to);
          const { getSql } = await import("@/lib/db");
          const windows = await bitrixBusyWindows(await getSql(), range.from, range.to, {
            force: true,
            nativeOnly: true,
          });
          return Response.json({ ok: true, windows }, { headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
        }
      },
    },
  },
});
