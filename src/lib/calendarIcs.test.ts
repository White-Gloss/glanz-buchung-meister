import { describe, expect, it } from "vitest";

import { escapeIcsText, icsMultiline, icsTimestamp, shiftIcsDate, toIcsDate } from "./calendarIcs";

describe("escapeIcsText", () => {
  it("escapes the characters that RFC 5545 reserves", () => {
    expect(escapeIcsText("Muster; Meier, GmbH \\ Co")).toBe("Muster\\; Meier\\, GmbH \\\\ Co");
  });

  it("turns real line breaks into the ICS sequence exactly once", () => {
    expect(escapeIcsText("Zeile 1\nZeile 2")).toBe("Zeile 1\\nZeile 2");
    expect(escapeIcsText("Zeile 1\r\nZeile 2")).toBe("Zeile 1\\nZeile 2");
  });
});

describe("icsMultiline", () => {
  it("keeps a single escape sequence per line break", () => {
    const value = icsMultiline(["Rechnung: RE-1", "Status: Bestätigt"]);

    expect(value).toBe("Rechnung: RE-1\\nStatus: Bestätigt");
    // Ein doppelter Backslash würde im Kalender als sichtbares "\n" landen.
    expect(value).not.toContain("\\\\n");
  });

  it("drops empty lines", () => {
    expect(icsMultiline(["Erste", null, undefined, false, "", "Zweite"])).toBe("Erste\\nZweite");
  });

  it("still escapes reserved characters inside the lines", () => {
    expect(icsMultiline(["Abholung: Horb, Neckar"])).toBe("Abholung: Horb\\, Neckar");
  });
});

describe("Datumshilfen", () => {
  it("formats an ISO date for all-day events", () => {
    expect(toIcsDate("2026-08-24")).toBe("20260824");
    expect(toIcsDate("2026-08-24T10:00:00.000Z")).toBe("20260824");
  });

  it("shifts across month boundaries", () => {
    expect(shiftIcsDate("2026-08-31", 1)).toBe("20260901");
    expect(shiftIcsDate("2026-03-01", -3)).toBe("20260226");
  });

  it("formats a UTC timestamp without separators", () => {
    expect(icsTimestamp(new Date("2026-08-24T09:07:05.123Z"))).toBe("20260824T090705Z");
  });
});
