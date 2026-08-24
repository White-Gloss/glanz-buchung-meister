import { describe, expect, it } from "vitest";
import { cacheControlForPath } from "./responseCache";

describe("cacheControlForPath", () => {
  it("verhindert veraltetes HTML auf öffentlichen Seiten", () => {
    expect(cacheControlForPath("/faq")).toBe("no-cache, must-revalidate");
    expect(cacheControlForPath("/ratgeber/lackpflege")).toBe("no-cache, must-revalidate");
    expect(cacheControlForPath("/agb")).toBe("no-cache, must-revalidate");
  });

  it("schützt Admin- und Anmeldeseiten vor Speicherung", () => {
    expect(cacheControlForPath("/admin")).toBe("private, no-store");
    expect(cacheControlForPath("/auth")).toBe("private, no-store");
    expect(cacheControlForPath("/danke")).toBe("private, no-store");
    // Die Dellen-Dankeseite zeigt denselben Kundennamen aus der Adresse.
    expect(cacheControlForPath("/danke-dellen")).toBe("private, no-store");
  });

  it("überschreibt private Token- und Serverantworten nicht", () => {
    expect(cacheControlForPath("/kalender/geheimer-token.ics")).toBeNull();
    expect(cacheControlForPath("/angebot/geheimer-token")).toBeNull();
    expect(cacheControlForPath("/_serverFn/listBookings")).toBeNull();
    expect(cacheControlForPath("/api/automation-cron")).toBeNull();
  });

  it("respektiert den eigenen öffentlichen Cache der Sitemap", () => {
    expect(cacheControlForPath("/sitemap.xml")).toBeNull();
  });
});
