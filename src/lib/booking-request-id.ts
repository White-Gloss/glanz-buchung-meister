const STORAGE_KEY = "white-gloss.booking-request.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Only the random request ID is persisted; customer and booking data stay out of storage. */
export function createBookingRequestIdStore(
  storage: () => RequestStorage | null,
  randomId: () => string,
) {
  let current: string | null = null;
  let loaded = false;
  return {
    get() {
      if (current) return current;
      if (!loaded) {
        loaded = true;
        try {
          const saved = storage()?.getItem(STORAGE_KEY);
          if (saved && UUID.test(saved)) current = saved;
        } catch {
          // Private browsing can deny storage; retries still share the in-memory ID.
        }
      }
      const next = current ?? randomId();
      if (!UUID.test(next)) throw new Error("Die Anfrage-ID konnte nicht erstellt werden.");
      current = next;
      try {
        storage()?.setItem(STORAGE_KEY, current);
      } catch {
        // The request is safe to submit even if persistence is unavailable.
      }
      return current;
    },
    clear() {
      current = null;
      loaded = true;
      try {
        storage()?.removeItem(STORAGE_KEY);
      } catch {
        // No customer data needs to be removed when storage is unavailable.
      }
    },
  };
}

export const bookingRequestId = createBookingRequestIdStore(
  () => (typeof window === "undefined" ? null : window.sessionStorage),
  () => globalThis.crypto.randomUUID(),
);
