import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  googleSiteVerificationMeta,
  parseGoogleSiteVerification,
} from "./googleSiteVerification.ts";

const CODE_A = "aBc123_def456-GHI789jklMNO";
const CODE_B = "zZy987_wvu654-TSR321qponML";

describe("parseGoogleSiteVerification", () => {
  it("liefert ohne Wert nichts — ein leeres content lehnt Google ab", () => {
    assert.deepEqual(parseGoogleSiteVerification(""), []);
    assert.deepEqual(parseGoogleSiteVerification(undefined), []);
    assert.deepEqual(parseGoogleSiteVerification(null), []);
    assert.deepEqual(parseGoogleSiteVerification("   "), []);
  });

  it("nimmt den einfachen Code unverändert", () => {
    assert.deepEqual(parseGoogleSiteVerification(CODE_A), [CODE_A]);
    assert.deepEqual(parseGoogleSiteVerification(`  ${CODE_A}  `), [CODE_A]);
  });

  it("trägt alte und neue Property gleichzeitig", () => {
    assert.deepEqual(parseGoogleSiteVerification(`${CODE_A},${CODE_B}`), [CODE_A, CODE_B]);
    assert.deepEqual(parseGoogleSiteVerification(`${CODE_A}; ${CODE_B}`), [CODE_A, CODE_B]);
    assert.deepEqual(parseGoogleSiteVerification(`${CODE_A}\n${CODE_B}`), [CODE_A, CODE_B]);
  });

  it("holt den Code aus einem versehentlich ganz kopierten Meta-Tag", () => {
    const getaggt = `<meta name="google-site-verification" content="${CODE_A}" />`;
    assert.deepEqual(parseGoogleSiteVerification(getaggt), [CODE_A]);
  });

  it("versteht auch zwei kopierte Tags hintereinander", () => {
    const zwei =
      `<meta name="google-site-verification" content="${CODE_A}">` +
      `<meta name="google-site-verification" content="${CODE_B}">`;
    assert.deepEqual(parseGoogleSiteVerification(zwei), [CODE_A, CODE_B]);
  });

  it("versteht die Schreibweise des DNS-TXT-Eintrags", () => {
    assert.deepEqual(parseGoogleSiteVerification(`google-site-verification=${CODE_A}`), [CODE_A]);
  });

  it("weist den Dateinamen der Datei-Methode ab — er bestätigt hier nichts", () => {
    assert.deepEqual(parseGoogleSiteVerification("googlec46de81dfa777419.html"), []);
    assert.deepEqual(
      parseGoogleSiteVerification("google-site-verification: googlef2a231c40b846ddd.html"),
      [],
    );
  });

  it("meldet denselben Code nicht zweimal", () => {
    assert.deepEqual(parseGoogleSiteVerification(`${CODE_A}, ${CODE_A}`), [CODE_A]);
  });
});

describe("googleSiteVerificationMeta", () => {
  it("erzeugt ohne Code kein Tag", () => {
    assert.deepEqual(googleSiteVerificationMeta(""), []);
  });

  it("erzeugt je Property ein eigenes Tag", () => {
    assert.deepEqual(googleSiteVerificationMeta(`${CODE_A},${CODE_B}`), [
      { name: "google-site-verification", content: CODE_A },
      { name: "google-site-verification", content: CODE_B },
    ]);
  });
});
