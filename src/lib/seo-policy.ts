import { cities, services, site } from "../data/site.ts";

export type LocalSeoEvidence = {
  reviewedOn: string;
  available: true;
  demand: {
    kind: "gsc" | "search-volume";
    query: string;
    value: number;
    period: string;
    reference: string;
  };
  facts: { text: string; reference: string }[];
  proof: { label: string; url: string; kind: "job" | "photo" | "review" };
};

/** Public, verified evidence only. Never place customer/order data in this client bundle.
 * No combination currently has all required evidence. GSC access alone is not evidence
 * of demand for every combination. See docs/seo-quality-gate.md for the review process.
 */
export const localSeoEvidence: Readonly<Record<string, LocalSeoEvidence>> = {};

export type SeoDecision =
  | { status: "index"; reason: string }
  | { status: "noindex"; reason: string }
  | { status: "redirect"; target: string; reason: string };

export const helperPaths = new Set([
  "/agb",
  "/datenschutz",
  "/widerruf",
  "/impressum",
  "/barrierefreiheit",
  "/datenloeschung",
  "/danke",
  "/login",
  "/auftragsstatus",
]);

export function hasLocalSeoEvidence(evidence?: LocalSeoEvidence): boolean {
  if (!evidence || evidence.available !== true) return false;
  const { demand, facts, proof } = evidence;
  let proofUrl: URL;
  try {
    proofUrl = new URL(proof.url);
  } catch {
    return false;
  }
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(evidence.reviewedOn) &&
    Number.isFinite(Date.parse(evidence.reviewedOn)) &&
    ["gsc", "search-volume"].includes(demand.kind) &&
    Number.isFinite(demand.value) &&
    demand.value > 0 &&
    !!demand.query.trim() &&
    !!demand.period.trim() &&
    !!demand.reference.trim() &&
    new Set(
      facts
        .filter((fact) => fact.text.trim() && fact.reference.trim())
        .map((fact) => fact.text.trim()),
    ).size >= 2 &&
    ["job", "photo", "review"].includes(proof.kind) &&
    !!proof.label.trim() &&
    proofUrl.protocol === "https:"
  );
}

export function serviceCitySeo(
  serviceSlug: string,
  citySlug: string,
  evidence = localSeoEvidence,
): SeoDecision {
  const service = services.find((item) => item.slug === serviceSlug);
  const city = cities.find((item) => item.slug === citySlug);
  if (!service || !city) return { status: "noindex", reason: "unknown-combination" };
  if (service.pendingApproval)
    return {
      status: "redirect",
      target: `/leistungen/${service.slug}`,
      reason: "unavailable-service-consolidated-into-explanation",
    };
  return hasLocalSeoEvidence(evidence[`${service.slug}/${city.slug}`])
    ? { status: "index", reason: "verified-local-demand-and-proof" }
    : { status: "noindex", reason: "local-demand-or-proof-not-yet-verified" };
}

/** Shared by SSR head, route loaders, navigation and the sitemap. */
export function publicSeo(path: string): SeoDecision {
  if (helperPaths.has(path) || /^\/(admin|api)(\/|$)/.test(path)) {
    return { status: "noindex", reason: "helper-or-private-page" };
  }
  const matrix = /^\/leistungen\/([^/]+)\/([^/]+)$/.exec(path);
  if (matrix) return serviceCitySeo(matrix[1], matrix[2]);
  const service = services.find((item) => path === `/leistungen/${item.slug}`);
  if (service?.pendingApproval) return { status: "noindex", reason: "unavailable-service" };
  return { status: "index", reason: "public-hub-or-editorial-page" };
}

export function seoRobots(path: string, requested?: string) {
  // Explicit private-page restrictions must never be weakened by the public policy.
  if (requested && /noindex/i.test(requested)) return requested;
  return publicSeo(path).status === "index"
    ? (requested ?? "index,follow,max-image-preview:large")
    : "noindex,follow";
}

export function filterIndexableSitemap(xml: string): string {
  return xml.replace(/\s*<url>\s*[\s\S]*?<\/url>/g, (entry) => {
    const loc = /<loc>([^<]+)<\/loc>/.exec(entry)?.[1];
    if (!loc) return "";
    try {
      const url = new URL(loc);
      return url.origin === site.origin &&
        !url.search &&
        !url.hash &&
        (url.pathname === "/" || !url.pathname.endsWith("/")) &&
        publicSeo(url.pathname).status === "index"
        ? entry
        : "";
    } catch {
      return "";
    }
  });
}

export function serviceAreaLink(serviceSlug: string, citySlug: string) {
  return serviceCitySeo(serviceSlug, citySlug).status === "index"
    ? { to: "/leistungen/$slug/$city" as const, params: { slug: serviceSlug, city: citySlug } }
    : {
        to: "/leistungen/$slug" as const,
        params: { slug: serviceSlug },
        search: { ort: citySlug },
      };
}

export function pickupAreaLink(serviceSlug: string, citySlug: string) {
  return serviceCitySeo(serviceSlug, citySlug).status === "index"
    ? { to: "/leistungen/$slug/$city" as const, params: { slug: serviceSlug, city: citySlug } }
    : {
        to: "/abholservice/$city" as const,
        params: { city: citySlug },
        search: { leistung: serviceSlug },
      };
}
