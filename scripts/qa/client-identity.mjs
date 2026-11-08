// Synthetic proxy identities for independent scenarios in the guarded Linux QA runner.
import { createHash } from "node:crypto";

const suites = new Set(["booking-ui", "responsive", "cross-browser", "website-studio", "hero-stability", "rate-limit-proof", "lighthouse"]);
const customerDocumentSuites = new Set(["booking-ui", "responsive", "cross-browser", "hero-stability", "lighthouse"]);

export function qaClientHeaders(suite, scenario) {
  if (!suites.has(suite) || typeof scenario !== "string" || !scenario.trim()) {
    throw new Error("An explicit QA suite and independent scenario are required");
  }
  // The documentation-only IPv6 range is a proxy fixture, never a network target.
  // Reuse this identity for EVERY request in a scenario; do not rotate per request.
  const suffix = createHash("sha256").update(`${suite}\0${scenario}`).digest("hex").slice(0, 24).match(/.{4}/g).join(":");
  return {
    "x-forwarded-for": `2001:db8:${suffix}`,
    // Match the existing production SSR fixture while retaining the isolated
    // loopback URL, Host and browser Origin. Otherwise the PWA injector treats
    // these public browser checks as a Grok development preview.
    ...(customerDocumentSuites.has(suite) ? { "x-forwarded-host": "white-gloss.de" } : {}),
  };
}
