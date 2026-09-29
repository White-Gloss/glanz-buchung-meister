import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import { roappOnlyEnabled } from "./booking-backend.ts";

type Booking = Pick<WorkflowBooking, "id" | "version">;
export async function queueCrmBooking(sql: Sql, booking: Booking) {
  if (roappOnlyEnabled()) {
    const { queueRoappBooking } = await import("./roapp-sync.ts");
    return queueRoappBooking(sql, booking);
  }
  const { queueBitrixBooking } = await import("./bitrix-sync.ts");
  return queueBitrixBooking(sql, booking);
}
export async function queueCrmPhotos(sql: Sql, booking: Booking) {
  if (roappOnlyEnabled()) return queueCrmBooking(sql, booking);
  const { queueBitrixPhotos } = await import("./bitrix-sync.ts");
  return queueBitrixPhotos(sql, booking);
}
export async function runCrmSync(sql: Sql) {
  if (roappOnlyEnabled()) {
    const { runRoappSync } = await import("./roapp-sync.ts");
    const { reconcileRoOrders } = await import("./roapp-callback.ts");
    const { runRoInvoices } = await import("./roapp-invoice.ts");
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
