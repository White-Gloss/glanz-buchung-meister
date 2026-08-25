import { describe, expect, it } from "vitest";
import {
  DENT_REPAIR_PRICE_LABEL,
  DENT_REPAIR_SERVICE_NAME,
  buildDentRepairSummary,
  normalizeDentRepairRequest,
} from "./dentRepair";

/**
 * Termin einige Tage in der Zukunft.
 *
 * Ein fest eingetragenes Datum lässt diesen Test zu dem Tag zerfallen, an dem
 * es verstreicht — `normalizeDentRepairRequest` weist Vergangenes ab, und die
 * Prüfung steht vor allen anderen. Genau das ist hier passiert. Die Angabe
 * folgt derselben lokalen Zeitrechnung wie `localToday()` in `dentRepair.ts`.
 */
function terminInTagen(tage: number): string {
  const datum = new Date();
  datum.setDate(datum.getDate() + tage);
  return [
    datum.getFullYear(),
    String(datum.getMonth() + 1).padStart(2, "0"),
    String(datum.getDate()).padStart(2, "0"),
  ].join("-");
}

const validRequest = {
  damageType: "Parkdelle",
  vehicleArea: "Beifahrertür vorne",
  dentCount: "2",
  dentSize: "etwa 2-Euro-Münze",
  vehicleMake: "BMW",
  vehicleModel: "3er Touring",
  photoPaths: ["123e4567-e89b-42d3-a456-426614174000/123-456.jpg"],
  name: "Max Mustermann",
  email: "MAX@example.de",
  phone: "+49 176 12345678",
  preferredDate: terminInTagen(7),
  assessmentMode: "Foto, wenn möglich",
  note: "Die Delle ist beim Einparken entstanden.",
  consent: true,
};

describe("normalizeDentRepairRequest", () => {
  it("normalisiert eine vollständige Begutachtungsanfrage ohne Preis", () => {
    const result = normalizeDentRepairRequest(validRequest);

    expect(result.email).toBe("max@example.de");
    expect(result.photoPaths).toHaveLength(1);
    expect(result.preferredDate).toBe(validRequest.preferredDate);
    expect(buildDentRepairSummary(result)).toContain(DENT_REPAIR_SERVICE_NAME);
    expect(buildDentRepairSummary(result)).toContain(DENT_REPAIR_PRICE_LABEL);
    expect(buildDentRepairSummary(result)).not.toMatch(/\d+[,.]\d{2}\s*€/);
  });

  it("verlangt alle fachlichen Schadens- und Fahrzeugangaben", () => {
    expect(() =>
      normalizeDentRepairRequest({
        ...validRequest,
        vehicleArea: "",
      }),
    ).toThrow("Fahrzeugbereich");
    expect(() =>
      normalizeDentRepairRequest({
        ...validRequest,
        dentCount: "",
      }),
    ).toThrow("Anzahl");
    expect(() =>
      normalizeDentRepairRequest({
        ...validRequest,
        vehicleModel: "",
      }),
    ).toThrow("Fahrzeugmodell");
  });

  it("akzeptiert nur die vorgesehenen Schadensarten und Begutachtungswege", () => {
    expect(() =>
      normalizeDentRepairRequest({ ...validRequest, damageType: "Totalschaden" }),
    ).toThrow("Schadensart");
    expect(() =>
      normalizeDentRepairRequest({ ...validRequest, assessmentMode: "Sofort reparieren" }),
    ).toThrow("Begutachtung");
  });

  it("verlangt Zustimmung und einen zukünftigen Begutachtungstermin", () => {
    expect(() => normalizeDentRepairRequest({ ...validRequest, consent: false })).toThrow(
      "Zustimmung",
    );
    // Fest in der Vergangenheit und dort auch bleibend.
    expect(() =>
      normalizeDentRepairRequest({ ...validRequest, preferredDate: "2020-01-01" }),
    ).toThrow("Termin");
    // Der heutige Tag zählt noch als zulässig, der gestrige nicht mehr.
    expect(() =>
      normalizeDentRepairRequest({ ...validRequest, preferredDate: terminInTagen(-1) }),
    ).toThrow("Termin");
    expect(
      normalizeDentRepairRequest({ ...validRequest, preferredDate: terminInTagen(0) })
        .preferredDate,
    ).toBe(terminInTagen(0));
  });

  it("begrenzt und validiert private Foto-Pfade", () => {
    expect(() =>
      normalizeDentRepairRequest({ ...validRequest, photoPaths: ["https://example.com/bild.jpg"] }),
    ).toThrow("Foto");
    expect(() =>
      normalizeDentRepairRequest({
        ...validRequest,
        photoPaths: Array.from(
          { length: 9 },
          (_, index) => `123e4567-e89b-42d3-a456-426614174000/123-${index}.jpg`,
        ),
      }),
    ).toThrow("höchstens 8");
  });
});
