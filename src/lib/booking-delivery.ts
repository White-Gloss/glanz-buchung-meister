import type { Sql } from "./db.ts";
import { runNotificationWorker } from "./notification-worker.ts";

/** IONOS runs a persistent Node process. Start delivery after the durable commit,
 * without making the customer wait on providers. The timer recovers work after
 * a restart; correctness never depends on this in-process optimisation.
 * CRM sync must not share the notification lock: a hanging CRM call would
 * leave customer mail queued. */
export function kickBookingDelivery(sql: Sql): void {
  const state = globalThis as typeof globalThis & {
    __bookingDeliveryKick?: () => void;
    __crmSyncKick?: () => void;
  };
  state.__bookingDeliveryKick ??= createDeliveryKick(
    async () => {
      await runNotificationWorker(sql);
    },
    () =>
      console.error(
        "[booking:delivery] Versandjob unterbrochen; gespeicherte Warteschlange bleibt erhalten.",
      ),
  );
  state.__crmSyncKick ??= createDeliveryKick(
    async () => {
      const { runCrmSync } = await import("./booking-crm.ts");
      await runCrmSync(sql);
    },
    () => console.error("[crm:sync] Übertragung unterbrochen; Warteschlange bleibt erhalten."),
  );
  state.__bookingDeliveryKick();
  state.__crmSyncKick();
}

export function createDeliveryKick(run: () => Promise<unknown>, onError: () => void): () => void {
  let running = false,
    dirty = false;
  return () => {
    dirty = true;
    if (running) return;
    running = true;
    void (async () => {
      try {
        while (dirty) {
          dirty = false;
          try {
            await run();
          } catch {
            onError();
          }
        }
      } finally {
        running = false;
      }
    })();
  };
}
