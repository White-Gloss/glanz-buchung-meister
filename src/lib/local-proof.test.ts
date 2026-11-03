import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localProof, type CityLocalProof } from "../data/local-proof.ts";
import {
  formatProofDate,
  formatProofMonth,
  localProofFor,
  localProofText,
  validateLocalProof,
} from "./local-proof.ts";

const today = new Date("2026-11-03T12:00:00Z");

const valid: CityLocalProof = {
  confirmedAt: "2026-11-02",
  pickupDays: "Dienstag und Donnerstag vormittags",
  handover: "Übergabe auf Wunsch auch auf dem Parkplatz Ihres Arbeitgebers.",
  references: [
    {
      month: "2026-10",
      vehicle: "BMW X5",
      service: "innenraumreinigung",
      summary:
        "Innenraum nach Hundetransport gereinigt, Polster gesaugt und Kofferraum aufbereitet.",
      photoId: "customer-09",
      consent: true,
    },
  ],
  faqs: [
    {
      question: "Holen Sie auch in den Teilorten ab?",
      answer: "Ja, die genaue Adresse stimmen wir vor dem Termin mit Ihnen ab.",
    },
  ],
};

const problemsFor = (patch: Partial<CityLocalProof>, slug = "tuebingen") =>
  validateLocalProof(slug, { ...valid, ...patch }, today);

const withReference = (patch: Partial<NonNullable<CityLocalProof["references"]>[number]>) =>
  problemsFor({ references: [{ ...valid.references![0], ...patch }] });

describe("local proof catalogue", () => {
  it("contains only complete, privacy-safe entries", () => {
    for (const [slug, proof] of Object.entries(localProof)) {
      if (!proof) continue;
      assert.deepEqual(validateLocalProof(slug, proof, new Date()), [], slug);
    }
  });

  it("shows no section for cities without confirmed facts", () => {
    assert.equal(localProofFor("unbekannt"), undefined);
    assert.equal(localProofText(undefined), "");
  });
});

describe("validateLocalProof", () => {
  it("accepts a complete entry", () => {
    assert.deepEqual(problemsFor({}), []);
  });

  it("rejects unknown cities and dates in the future", () => {
    assert.ok(problemsFor({}, "stuttgart").some((p) => p.includes("unbekannter Abholort")));
    assert.ok(problemsFor({ confirmedAt: "2026-11-04" }).some((p) => p.includes("Zukunft")));
    assert.ok(problemsFor({ confirmedAt: "03.11.2026" }).some((p) => p.includes("JJJJ-MM-TT")));
    assert.ok(withReference({ month: "2026-12" }).some((p) => p.includes("Zukunft")));
  });

  it("rejects services that are unknown or not bookable", () => {
    assert.ok(
      withReference({ service: "felgenreparatur" }).some((p) => p.includes("unbekannte Leistung")),
    );
    assert.ok(
      withReference({ service: "scheinwerferaufbereitung" }).some((p) =>
        p.includes("nicht buchbar"),
      ),
    );
    assert.ok(
      withReference({ photoId: "customer-99" }).some((p) => p.includes("unbekanntes Foto")),
    );
  });

  it("rejects copy that could identify a customer", () => {
    const summary = (text: string) =>
      withReference({ summary: `Innenraum und Lack gereinigt und poliert. ${text}` });
    assert.ok(summary("Kennzeichen TÜ-AB 123.").some((p) => p.includes("Kennzeichen")));
    assert.ok(summary("Kennzeichen FDS XY 12.").some((p) => p.includes("Kennzeichen")));
    assert.ok(summary("Kontakt max@example.de.").some((p) => p.includes("E-Mail")));
    assert.ok(summary("Rückruf unter 0151 2345678.").some((p) => p.includes("Telefonnummer")));
    assert.ok(
      summary("Abholung in der Bahnhofstraße 12.").some((p) => p.includes("Straßenangabe")),
    );
  });

  it("allows model names that resemble plates", () => {
    for (const vehicle of ["BMW M3", "BMW X5", "VW ID 3", "Audi RS 6 Avant"]) {
      assert.deepEqual(withReference({ vehicle }), [], vehicle);
    }
  });

  it("requires real questions and substantial answers", () => {
    const faq = (question: string, answer = valid.faqs![0].answer) =>
      problemsFor({ faqs: [{ question, answer }] });
    assert.ok(faq("Holen Sie auch in den Teilorten ab").some((p) => p.includes("mit ? enden")));
    assert.ok(faq("Holen Sie auch ab?", "Ja.").some((p) => p.includes("mindestens 30")));
  });
});

describe("formatting", () => {
  it("formats month and date in German", () => {
    assert.equal(formatProofMonth("2026-10"), "Oktober 2026");
    assert.equal(formatProofDate("2026-11-03"), "03.11.2026");
  });

  it("collects all visible copy", () => {
    const text = localProofText(valid);
    for (const part of [
      "Dienstag",
      "Arbeitgebers",
      "BMW X5",
      "Hundetransport",
      "Teilorten",
      "Adresse",
    ]) {
      assert.ok(text.includes(part), part);
    }
  });
});
