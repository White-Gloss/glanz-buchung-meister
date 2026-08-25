import { describe, expect, it } from "vitest";

import { fehlerBeschreiben, protokollZeile, redigieren } from "./serverLog";

describe("redigieren", () => {
  it("removes e-mail addresses", () => {
    expect(redigieren("Key (customer_email)=(max@example.de) already exists")).not.toContain(
      "max@example.de",
    );
    expect(redigieren("an max.mustermann+tag@sub.example.co.uk gesendet")).toBe(
      "an [entfernt] gesendet",
    );
  });

  it("removes phone numbers in the shapes the forms accept", () => {
    for (const nummer of ["+49 176 12345678", "0176/1234567", "07451 123456"]) {
      expect(redigieren(`Telefon ${nummer} ungültig`)).not.toContain(nummer);
    }
  });

  it("removes anything long enough to be a key or token", () => {
    const token = "sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    expect(redigieren(`Authorization Bearer ${token}`)).not.toContain(token);
  });

  it("leaves ordinary text and short numbers alone", () => {
    expect(redigieren("HTTP 422 beim Versand")).toBe("HTTP 422 beim Versand");
    // Die Rechnungsnummer muss stehen bleiben — ohne sie ist die Zeile im
    // Protokoll nicht mehr einem Vorgang zuzuordnen.
    expect(redigieren("Buchung WGD-2026-17 bestätigt")).toBe("Buchung WGD-2026-17 bestätigt");
    expect(redigieren("Vorgang WGD-2026-1234 storniert")).toContain("WGD-2026-1234");
  });
});

describe("fehlerBeschreiben", () => {
  it("keeps only name and message, never the other properties", () => {
    // Genau die Form, in der der PostgreSQL-Treiber Nutzdaten mitliefert.
    const dbFehler = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
      detail: "Key (customer_email)=(max@example.de) already exists.",
      where: "SQL statement",
    });
    const beschrieben = fehlerBeschreiben(dbFehler);

    expect(beschrieben).toBe("Error: duplicate key value violates unique constraint");
    expect(beschrieben).not.toContain("max@example.de");
    expect(beschrieben).not.toContain("23505");
  });

  it("redacts inside the message itself", () => {
    expect(fehlerBeschreiben(new Error("Zustellung an kunde@example.de scheiterte"))).toBe(
      "Error: Zustellung an [entfernt] scheiterte",
    );
  });

  it("shortens a very long message", () => {
    expect(fehlerBeschreiben(new Error("x".repeat(5000))).length).toBeLessThanOrEqual(300);
  });

  it("copes with values that are not errors", () => {
    expect(fehlerBeschreiben("schlicht kaputt")).toBe("schlicht kaputt");
    expect(fehlerBeschreiben(null)).toBe("(kein Fehlerwert)");
    expect(fehlerBeschreiben(undefined)).toBe("(kein Fehlerwert)");
    expect(fehlerBeschreiben(42)).toContain("42");
    expect(() => fehlerBeschreiben({ a: 1 })).not.toThrow();
  });

  it("names an error without a message instead of returning nothing", () => {
    expect(fehlerBeschreiben(new Error(""))).toBe("Error: (ohne Meldung)");
  });
});

describe("protokollZeile", () => {
  it("builds one line with area, event and context", () => {
    expect(
      protokollZeile("mail", "Kundenmail fehlgeschlagen", undefined, { vorgang: "WGD-1" }),
    ).toBe("[mail] Kundenmail fehlgeschlagen vorgang=WGD-1");
  });

  it("appends the error as a quoted summary", () => {
    const zeile = protokollZeile("mail", "Versand", new Error("Zeitüberschreitung"));
    expect(zeile).toBe('[mail] Versand fehler="Error: Zeitüberschreitung"');
  });

  it("skips empty context entries instead of printing them", () => {
    expect(
      protokollZeile("erpnext", "Abgleich", undefined, { a: "", b: null, c: undefined, d: 0 }),
    ).toBe("[erpnext] Abgleich d=0");
  });

  it("redacts context values too", () => {
    expect(protokollZeile("mail", "Versand", undefined, { an: "kunde@example.de" })).toBe(
      "[mail] Versand an=[entfernt]",
    );
  });
});

describe("fehlerBeschreiben mit Stack", () => {
  it("adds the call path but keeps redacting it", () => {
    const fehler = new Error("Zustellung an kunde@example.de scheiterte");
    const beschrieben = fehlerBeschreiben(fehler, { mitStack: true });

    expect(beschrieben.split("\n").length).toBeGreaterThan(1);
    expect(beschrieben).toContain("serverLog.test");
    expect(beschrieben).not.toContain("kunde@example.de");
  });

  it("returns just the head when there is no stack", () => {
    const ohneStack = new Error("kaputt");
    ohneStack.stack = undefined;
    expect(fehlerBeschreiben(ohneStack, { mitStack: true })).toBe("Error: kaputt");
  });
});
