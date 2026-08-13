import { servicePackages } from "./servicesConfig";

export type HomeSearch = { paket?: string };

export function parseHomeSearch(search: Record<string, unknown>): HomeSearch {
  const packageId = search.paket;
  if (
    typeof packageId === "string" &&
    servicePackages.some((servicePackage) => servicePackage.id === packageId)
  ) {
    return { paket: packageId };
  }
  return {};
}
