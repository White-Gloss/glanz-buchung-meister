import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyBookingSelection,
  parseBookingSelection,
  serviceBookingSelection,
} from "./booking-selection.ts";
import { quoteTotal } from "../data/site.ts";

test("interior, polish and ceramic links select the advertised package", () => {
  assert.deepEqual(serviceBookingSelection("innenraumreinigung"), { paket: "basis" });
  assert.deepEqual(serviceBookingSelection("lackkorrektur"), { paket: "premium" });
  assert.deepEqual(serviceBookingSelection("keramikversiegelung", "nagold"), {
    paket: "keramik",
    ort: "nagold",
  });
});
test("individual services do not silently add a priced package", () => {
  assert.deepEqual(serviceBookingSelection("lederpflege", "nagold"), {
    leistung: "lederpflege",
    ort: "nagold",
  });
});
test("direct and malformed inputs do not override the customer's selection", () => {
  for (const raw of [
    {},
    { paket: "__proto__", ort: "unknown" },
    { paket: "constructor" },
    { paket: ["basis"] },
  ]) {
    assert.deepEqual(parseBookingSelection(raw), {});
  }
  assert.deepEqual(parseBookingSelection({ paket: "Pur" }), { paket: "basis" });
  const current = {
    packageId: "keramik" as const,
    citySlug: "nagold",
    name: "Test",
    extraIds: ["ozon"],
  };
  assert.deepEqual(applyBookingSelection(current, {}), current);
  assert.deepEqual(applyBookingSelection(current, { paket: "basis" }), {
    ...current,
    packageId: "basis",
  });
});
test("quote preserves class factors and adds pickup after the vehicle services", () => {
  assert.equal(
    quoteTotal({ packageId: "basis", classId: "kompakt", extraIds: [], citySlug: "horb-am-neckar" })
      .total,
    149,
  );
  const q = quoteTotal({
    packageId: "basis",
    classId: "suv",
    extraIds: ["ozon"],
    citySlug: "nagold",
  });
  assert.equal(q.subtotal, (149 + 99) * 1.25);
  assert.equal(q.total, q.subtotal + (q.pickup ?? 0));
});
test("included glass sealing and leather care are not charged again; wheel disassembly stays separate", () => {
  const base = { packageId: "keramik" as const, classId: "kompakt" as const, citySlug: "nagold" };
  assert.equal(quoteTotal({ ...base, extraIds: ["glas"] }).total, 899);
  assert.equal(quoteTotal({ ...base, extraIds: ["glas", "leder"] }).total, 899);
  assert.equal(quoteTotal({ ...base, extraIds: ["glas", "felgen"] }).total, 1018);
  assert.equal(quoteTotal({ ...base, packageId: "basis", extraIds: ["glas"] }).extrasSum, 99);
});
