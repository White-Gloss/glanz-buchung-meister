import {
  cities,
  packageServiceSlug,
  parsePackageSearch,
  services,
  type PackageId,
} from "../data/site.ts";

export type BookingSelection = { paket?: PackageId; ort?: string; leistung?: string };

export function parseBookingSelection(raw: Record<string, unknown>): BookingSelection {
  const paket = typeof raw.paket === "string" ? parsePackageSearch(raw.paket) : undefined;
  const ort =
    typeof raw.ort === "string" && cities.some((c) => c.slug === raw.ort) ? raw.ort : undefined;
  const leistung =
    typeof raw.leistung === "string" && services.some((s) => s.slug === raw.leistung)
      ? raw.leistung
      : undefined;
  return {
    ...(paket ? { paket } : {}),
    ...(ort ? { ort } : {}),
    ...(leistung ? { leistung } : {}),
  };
}

/** Only the three documented package services select a priced package. */
export function serviceBookingSelection(slug: string, city?: string): BookingSelection {
  const paket = (Object.keys(packageServiceSlug) as PackageId[]).find(
    (id) => packageServiceSlug[id] === slug,
  );
  return parseBookingSelection({
    paket,
    ort: city,
    leistung: paket || slug === "fahrzeugaufbereitung" ? undefined : slug,
  });
}

export function applyBookingSelection<T extends { packageId: PackageId; citySlug: string }>(
  current: T,
  selection: BookingSelection,
): T {
  return {
    ...current,
    ...(selection.paket ? { packageId: selection.paket } : {}),
    ...(selection.ort ? { citySlug: selection.ort } : {}),
  };
}
