import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const loginSrc = readFileSync(fileURLToPath(new URL("./login.tsx", import.meta.url)), "utf8");

describe("login copy", () => {
  it("offers Google and never advertises public signup or X", () => {
    assert.equal(/Weiter mit Google/.test(loginSrc), true);
    assert.equal(/Weiter mit X/.test(loginSrc), false);
    assert.equal(/Konto anlegen/.test(loginSrc), false);
    assert.equal(/Noch kein Konto\? Registrieren/.test(loginSrc), false);
  });
});
