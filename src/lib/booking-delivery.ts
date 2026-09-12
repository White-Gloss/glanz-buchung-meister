import type { Sql } from "./db.ts";
import { runNotificationWorker } from "./notification-worker.ts";
import { runZohoSync } from "./zoho-sync.ts";

/** IONOS runs a persistent Node process. Start delivery after the durable commit,
 * without making the customer wait on providers. The timer recovers work after
 * a restart; correctness never depends on this in-process optimisation. */
export function kickBookingDelivery(sql: Sql): void {
  const state = globalThis as typeof globalThis & { __bookingDeliveryKick?: () => void };
  state.__bookingDeliveryKick ??= createDeliveryKick(
    async () => {
      await runNotificationWorker(sql);
      await runZohoSync(sql);
    },
    () =>
      console.error(
        "[booking:delivery] Versandjob unterbrochen; gespeicherte Warteschlange bleibt erhalten.",
      ),
  );
  state.__bookingDeliveryKick();
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
