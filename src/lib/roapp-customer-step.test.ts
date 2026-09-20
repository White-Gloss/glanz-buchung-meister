import assert from "node:assert/strict";
import { test } from "node:test";
import { roappCustomerStep } from "./roapp-customer-step.ts";

test("only a released offer asks for customer acceptance", () => {
  assert.equal(
    roappCustomerStep("Fixpreis bestätigt", true).linkLabel,
    "Auftrag prüfen und unterschreiben",
  );
  assert.equal(roappCustomerStep("Fixpreis bestätigt", false).linkLabel, null);
  assert.equal(roappCustomerStep("Akzeptiert", false).linkLabel, null);
  for (const status of ["Akzeptiert", "In Arbeit", "Erledigt", "Geschlossen", "Archiviert"])
    assert.equal(roappCustomerStep(status, true).linkLabel, "Auftrag ansehen");
});

test("rejected requests never offer an acceptance link even after price approval", () => {
  for (const status of ["Abgelehnt", "Abgelehnt – Preis", "Storniert"])
    for (const fixed of [true, false])
      assert.equal(roappCustomerStep(status, fixed).linkLabel, null);
});
