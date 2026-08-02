import { createServerFn } from "@tanstack/react-start";
import type { ServicePriceRow } from "./servicesConfig";

/**
 * Öffentliche Preisliste. Die eigentliche Datenbankabfrage liegt in
 * `pricing.server.ts` und wird erst im Handler geladen – so landet weder der
 * Postgres- noch der Supabase-Client im Browser-Bundle.
 */
export const listServicePrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServicePriceRow[]> => {
    const { readServicePrices } = await import("./pricing.server");
    return readServicePrices();
  },
);
