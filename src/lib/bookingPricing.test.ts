import { describe, expect, it } from "vitest";

import { calcDeposit, calcLineItems, calcTotals } from "./bookings";

const KOMPAKT = { vehicleId: "kompakt", packageId: "basis", addOnIds: [] as string[] };

describe("calcLineItems", () => {
  it("scales the package price with the vehicle factor", () => {
    const kompakt = calcLineItems(KOMPAKT);
    const suv = calcLineItems({ ...KOMPAKT, vehicleId: "suv" });

    expect(kompakt[0].total).toBe(149);
    // Faktor 1,25 auf den Grundpreis, kaufmännisch gerundet.
    expect(suv[0].total).toBe(186);
  });

  it("counts a repeated add-on once", () => {
    const einmal = calcLineItems({ ...KOMPAKT, addOnIds: ["felgen"] });
    const dreimal = calcLineItems({ ...KOMPAKT, addOnIds: ["felgen", "felgen", "felgen"] });

    expect(dreimal).toEqual(einmal);
    expect(calcTotals(dreimal).gross).toBe(calcTotals(einmal).gross);
  });

  it("keeps distinct add-ons apart", () => {
    const items = calcLineItems({ ...KOMPAKT, addOnIds: ["felgen", "ozon", "felgen"] });

    expect(items).toHaveLength(3);
    expect(calcTotals(items).gross).toBe(149 + 89 + 59);
  });

  it("ignores an unknown add-on instead of pricing it", () => {
    expect(calcLineItems({ ...KOMPAKT, addOnIds: ["gibtesnicht"] })).toEqual(
      calcLineItems(KOMPAKT),
    );
  });

  it("prices the pickup by distance and marks it included where it is", () => {
    const nahe = calcLineItems({
      ...KOMPAKT,
      addOnIds: ["hol"],
      pickupCity: "horb-am-neckar",
    });
    expect(nahe.at(-1)?.total).toBe(0);

    const weiter = calcLineItems({ ...KOMPAKT, addOnIds: ["hol"], pickupCity: "nagold" });
    expect(weiter.at(-1)?.total).toBe(50);

    const imKeramikpaket = calcLineItems({
      ...KOMPAKT,
      packageId: "keramik",
      addOnIds: ["hol"],
      pickupCity: "nagold",
    });
    expect(imKeramikpaket.at(-1)).toMatchObject({ total: 0 });
  });

  it("leaves out a pickup without a usable city", () => {
    const items = calcLineItems({ ...KOMPAKT, addOnIds: ["hol"], pickupCity: null });
    expect(items).toEqual(calcLineItems(KOMPAKT));
  });
});

describe("calcTotals", () => {
  it("adds the line totals", () => {
    expect(calcTotals([]).gross).toBe(0);
    expect(
      calcTotals([
        { label: "a", qty: 1, unit: 10, total: 10 },
        { label: "b", qty: 1, unit: 5, total: 5 },
      ]).gross,
    ).toBe(15);
  });
});

describe("calcDeposit", () => {
  it("only asks new customers for a deposit", () => {
    expect(calcDeposit(500, false)).toBe(0);
    expect(calcDeposit(500, true)).toBeGreaterThan(0);
  });

  it("rounds to whole cents", () => {
    const betrag = calcDeposit(333.33, true);
    expect(Number.isFinite(betrag)).toBe(true);
    expect(Math.round(betrag * 100)).toBe(betrag * 100);
  });
});
