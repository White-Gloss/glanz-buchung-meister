import { site } from "../../data/site.ts";

/** Öffentliche Origins dieser Website – unabhängig von Preview-Hosts. */
export function productionSiteOrigins(): string[] {
  const origin = site.origin.replace(/\/$/, "");
  const www = origin.replace("://", "://www.");
  return www === origin ? [origin] : [origin, www];
}

/**
 * IONOS-Produktion hat oft kein BETTER_AUTH_URL. Ohne Fallback würde Better Auth
 * localhost:8080 und die Grok-Preview-Hosts vertrauen – die Live-Domain nicht.
 */
export function resolveBetterAuthBaseURL(
  betterAuthUrl: string | undefined,
  nodeEnv: string,
): string | undefined {
  const explicit = betterAuthUrl?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (nodeEnv === "production") return productionSiteOrigins()[0];
  return undefined;
}

/** Der Grok-Preview-OAuth-Client gilt nur für *.grok-sandbox.com, nie für white-gloss.de. */
export function previewOAuthFallbackAllowed(nodeEnv: string): boolean {
  return nodeEnv !== "production";
}

export function uniqueOrigins(origins: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const origin of origins) {
    const value = origin?.trim().replace(/\/$/, "");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
