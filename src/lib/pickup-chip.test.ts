import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cities, pickupPriceText } from "../data/site.ts";
import { pickupDistanceLabel, pickupStatus } from "./city-copy.ts";

describe("Abholort-Chips", () => {
  it("zeigen Entfernungen mit dem Wortlaut der Ortsseiten", () => {
    assert.equal(pickupDistanceLabel({ km: null }), "Nach Adresse");
    assert.equal(pickupDistanceLabel({ km: 0 }), "Standort");
    assert.equal(pickupDistanceLabel({ km: 35 }), "ca. 35 km");
  });

  it("leiten den Status aus derselben Preislogik ab wie der angezeigte Preis", () => {
    for (const city of cities) {
      const text = pickupPriceText(city.km);
      const status = pickupStatus(city.km);
      if (text === "auf Anfrage") assert.equal(status, "request", city.slug);
      else if (text === "kostenlos") assert.equal(status, "free", city.slug);
      else assert.equal(status, "fixed", `${city.slug}: ${text}`);
    }
  });

  it("behandeln die Tarifgrenzen wie der Abholpreis", () => {
    assert.equal(pickupStatus(0), "free");
    assert.equal(pickupStatus(null), "request");
    assert.equal(pickupStatus(52), "request");
  });
});
