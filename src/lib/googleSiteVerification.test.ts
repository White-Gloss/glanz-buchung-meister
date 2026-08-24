import { describe, expect, it } from "vitest";
import { googleSiteVerificationMeta, parseGoogleSiteVerification } from "./googleSiteVerification";

const CODE_A = "aBc123_def456-GHI789jklMNO";
const CODE_B = "zZy987_wvu654-TSR321qponML";

describe("parseGoogleSiteVerification", () => {
  it("liefert ohne Wert nichts — ein leeres content lehnt Google ab", () => {
    expect(parseGoogleSiteVerification("")).toEqual([]);
    expect(parseGoogleSiteVerification(undefined)).toEqual([]);
    expect(parseGoogleSiteVerification(null)).toEqual([]);
    expect(parseGoogleSiteVerification("   ")).toEqual([]);
  });

  it("nimmt den einfachen Code unverändert", () => {
    expect(parseGoogleSiteVerification(CODE_A)).toEqual([CODE_A]);
    expect(parseGoogleSiteVerification(`  ${CODE_A}  `)).toEqual([CODE_A]);
  });

  it("trägt alte und neue Property gleichzeitig", () => {
    expect(parseGoogleSiteVerification(`${CODE_A},${CODE_B}`)).toEqual([CODE_A, CODE_B]);
    expect(parseGoogleSiteVerification(`${CODE_A}; ${CODE_B}`)).toEqual([CODE_A, CODE_B]);
    expect(parseGoogleSiteVerification(`${CODE_A}\n${CODE_B}`)).toEqual([CODE_A, CODE_B]);
  });

  it("holt den Code aus einem versehentlich ganz kopierten Meta-Tag", () => {
    const getaggt = `<meta name="google-site-verification" content="${CODE_A}" />`;
    expect(parseGoogleSiteVerification(getaggt)).toEqual([CODE_A]);
  });

  it("versteht auch zwei kopierte Tags hintereinander", () => {
    const zwei =
      `<meta name="google-site-verification" content="${CODE_A}">` +
      `<meta name="google-site-verification" content="${CODE_B}">`;
    expect(parseGoogleSiteVerification(zwei)).toEqual([CODE_A, CODE_B]);
  });

  it("versteht die Schreibweise des DNS-TXT-Eintrags", () => {
    expect(parseGoogleSiteVerification(`google-site-verification=${CODE_A}`)).toEqual([CODE_A]);
  });

  it("weist den Dateinamen der Datei-Methode ab — er bestätigt hier nichts", () => {
    expect(parseGoogleSiteVerification("googlec46de81dfa777419.html")).toEqual([]);
    expect(
      parseGoogleSiteVerification("google-site-verification: googlef2a231c40b846ddd.html"),
    ).toEqual([]);
  });

  it("meldet denselben Code nicht zweimal", () => {
    expect(parseGoogleSiteVerification(`${CODE_A}, ${CODE_A}`)).toEqual([CODE_A]);
  });
});

describe("googleSiteVerificationMeta", () => {
  it("erzeugt ohne Code kein Tag", () => {
    expect(googleSiteVerificationMeta("")).toEqual([]);
  });

  it("erzeugt je Property ein eigenes Tag", () => {
    expect(googleSiteVerificationMeta(`${CODE_A},${CODE_B}`)).toEqual([
      { name: "google-site-verification", content: CODE_A },
      { name: "google-site-verification", content: CODE_B },
    ]);
  });
});
