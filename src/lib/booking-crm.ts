import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import { panelOnlyEnabled, roappOnlyEnabled } from "./booking-backend.ts";

type Booking = Pick<WorkflowBooking, "id" | "version">;
export async function queueCrmBooking(sql: Sql, booking: Booking) {
  if (panelOnlyEnabled()) return;
  if (roappOnlyEnabled()) {
    const { queueRoappBooking } = await import("./roapp-sync.ts");
    return queueRoappBooking(sql, booking);
  }
  const { queueBitrixBooking } = await import("./bitrix-sync.ts");
  return queueBitrixBooking(sql, booking);
}
export async function queueCrmPhotos(sql: Sql, booking: Booking) {
  if (panelOnlyEnabled()) return;
  if (roappOnlyEnabled()) return queueCrmBooking(sql, booking);
  const { queueBitrixPhotos } = await import("./bitrix-sync.ts");
  return queueBitrixPhotos(sql, booking);
}
export async function runCrmSync(sql: Sql) {
  if (panelOnlyEnabled()) return { backend: "panel", skipped: 1 };
  if (roappOnlyEnabled()) {
    const { runRoappSync } = await import("./roapp-sync.ts");
    const { reconcileRoOrders } = await import("./roapp-callback.ts");
    const { runRoInvoices } = await import("./roapp-invoice.ts");
    const { logRoappDiagnostics } = await import("./roapp-sync.ts");
    await logRoappDiagnostics(sql).catch(() =>
      console.error("[roapp-sync] diagnostics_failed; keine Kundendaten protokolliert."),
    );
    const result = await runRoappSync(sql);
    const reconciled = await reconcileRoOrders(sql);
    // Invoice problems must not stop request transfer or status reconciliation.
    const invoices = await runRoInvoices(sql).catch(() => {
      console.error("[roapp-invoice] Lauf fehlgeschlagen; keine Kundendaten protokolliert.");
      return { error: "invoice_run_failed" };
    });
    return { backend: "roapp", ...result, ...reconciled, invoices };
  }
  const { runBitrixSync } = await import("./bitrix-sync.ts");
  return { backend: "bitrix", ...(await runBitrixSync(sql)) };
}
export async function crmBusyWindows(sql: Sql, from: string, to: string, force = false) {
  // Requests contain preferred times. The panel separately confirms the actual appointment.
  if (panelOnlyEnabled()) return [];
  if (roappOnlyEnabled()) {
    const { roappBusyWindows } = await import("./roapp-calendar.ts");
    // This tenant has one operator and no resource mapping. One RO interval
    // blocks both website capacity lanes; never invent a second free bay.
    return (await roappBusyWindows(from, to)).flatMap((window) => [
      window,
      { ...window, resourceId: 2 },
    ]);
  }
  const { bitrixBusyWindows } = await import("./bitrix-calendar.ts");
  return bitrixBusyWindows(sql, from, to, force ? { force: true, nativeOnly: true } : undefined);
}
