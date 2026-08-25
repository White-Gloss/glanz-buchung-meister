import { describe, expect, it } from "vitest";

import {
  alterInTagen,
  DRAFT_MAX_AGE_MS,
  istErwaehnenswert,
  lesen,
  serialisieren,
  type BookingDraftInput,
} from "./bookingDraft";

const JETZT = Date.parse("2026-08-25T12:00:00Z");

const leer: BookingDraftInput = {
  step: 0,
  packageId: null,
  vehicleId: null,
  selectedAddOnIds: [],
  pickupCity: "",
  conditionNote: "",
  date: null,
  preferredContact: "E-Mail",
  customer: { name: "", email: "", phone: "", plate: "" },
};

const angefangen: BookingDraftInput = {
  ...leer,
  step: 2,
  packageId: "premium",
  vehicleId: "suv",
  selectedAddOnIds: ["felgen", "ozon"],
  date: "2026-09-01",
  customer: {
    name: "Max Mustermann",
    email: "max@example.de",
    phone: "0176 1234567",
    plate: "HB-XY-42",
  },
};

describe("istErwaehnenswert", () => {
  it("does not offer to resume an untouched form", () => {
    expect(istErwaehnenswert(leer)).toBe(false);
    expect(istErwaehnenswert({ ...leer, conditionNote: "   " })).toBe(false);
  });

  it("counts any single entry as worth keeping", () => {
    expect(istErwaehnenswert({ ...leer, packageId: "basis" })).toBe(true);
    expect(istErwaehnenswert({ ...leer, customer: { ...leer.customer, name: "Max" } })).toBe(true);
    expect(istErwaehnenswert({ ...leer, selectedAddOnIds: ["felgen"] })).toBe(true);
  });
});

describe("serialisieren und lesen", () => {
  it("returns what was put in", () => {
    const gelesen = lesen(serialisieren(angefangen, JETZT), JETZT);
    expect(gelesen).toEqual({ ...angefangen, gespeichertAm: JETZT });
  });

  it("keeps a draft inside the retention window and drops it after", () => {
    const roh = serialisieren(angefangen, JETZT);
    expect(lesen(roh, JETZT + DRAFT_MAX_AGE_MS - 1000)).not.toBeNull();
    expect(lesen(roh, JETZT + DRAFT_MAX_AGE_MS + 1000)).toBeNull();
  });

  it("refuses a timestamp from the future", () => {
    expect(lesen(serialisieren(angefangen, JETZT + 600_000), JETZT)).toBeNull();
  });

  it("returns null for nothing, rubbish and the wrong shape", () => {
    expect(lesen(null, JETZT)).toBeNull();
    expect(lesen("", JETZT)).toBeNull();
    expect(lesen("kein json", JETZT)).toBeNull();
    expect(lesen("[]", JETZT)).toBeNull();
    expect(lesen('"text"', JETZT)).toBeNull();
    expect(lesen("{}", JETZT)).toBeNull();
    expect(lesen(JSON.stringify({ gespeichertAm: "gestern" }), JETZT)).toBeNull();
  });

  it("repairs a damaged draft instead of passing the damage on", () => {
    const kaputt = JSON.stringify({
      gespeichertAm: JETZT,
      step: 999,
      packageId: 42,
      selectedAddOnIds: ["felgen", "felgen", 7, null],
      date: "irgendwann",
      customer: { name: "Max", email: null },
      conditionNote: "x".repeat(9000),
    });
    const gelesen = lesen(kaputt, JETZT);

    expect(gelesen).not.toBeNull();
    expect(gelesen!.step).toBe(0);
    expect(gelesen!.packageId).toBeNull();
    expect(gelesen!.selectedAddOnIds).toEqual(["felgen"]);
    expect(gelesen!.date).toBeNull();
    expect(gelesen!.customer.name).toBe("Max");
    expect(gelesen!.customer.email).toBe("");
    expect(gelesen!.conditionNote.length).toBe(4000);
  });

  it("keeps a valid date and rejects a malformed one", () => {
    expect(lesen(serialisieren({ ...leer, date: "2026-09-01" }, JETZT), JETZT)!.date).toBe(
      "2026-09-01",
    );
    expect(lesen(serialisieren({ ...leer, date: "01.09.2026" }, JETZT), JETZT)!.date).toBeNull();
  });
});

describe("alterInTagen", () => {
  it("counts whole days", () => {
    const entwurf = lesen(serialisieren(angefangen, JETZT), JETZT)!;
    expect(alterInTagen(entwurf, JETZT)).toBe(0);
    expect(alterInTagen(entwurf, JETZT + 36 * 60 * 60 * 1000)).toBe(1);
    expect(alterInTagen(entwurf, JETZT + 3 * 24 * 60 * 60 * 1000)).toBe(3);
  });
});
