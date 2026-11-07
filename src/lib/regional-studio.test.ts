import assert from "node:assert/strict";
import { test } from "node:test";
import { cities, cityPickupPriceText, services } from "../data/site.ts";
import { cityJourneyText, citySeoCopy } from "./city-copy.ts";
import { publicSeo, serviceCitySeo } from "./seo-policy.ts";
import { studioMetadata } from "./studio-public.ts";

const confirmed: Record<string, [number, number, string]> = {
  "horb-am-neckar": [0, 10, "kostenlos"],
  "sulz-am-neckar": [12, 13, "30 €"],
  empfingen: [10, 12, "kostenlos"],
  voehringen: [17, 19, "30 €"],
  dornhan: [20, 23, "50 €"],
  dornstetten: [19, 19, "50 €"],
  schopfloch: [11, 11, "30 €"],
  nagold: [20, 25, "50 €"],
  "rottenburg-am-neckar": [25, 30, "70 €"],
  freudenstadt: [30, 35, "70 €"],
  "oberndorf-am-neckar": [30, 35, "70 €"],
  herrenberg: [35, 40, "70 €"],
  tuebingen: [35, 40, "70 €"],
  calw: [40, 45, "70 €"],
  balingen: [45, 50, "70 €"],
  rottweil: [45, 50, "70 €"],
  boeblingen: [50, 55, "70 €"],
  reutlingen: [50, 55, "70 €"],
  sindelfingen: [52, 60, "auf Anfrage"],
};

test("all 19 pickup hubs retain distinct metadata, index policy and their confirmed logistics", () => {
  assert.equal(cities.length, 19);
  assert.deepEqual(cities.map((city) => city.slug).sort(), Object.keys(confirmed).sort());
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const city of cities) {
    const copy = citySeoCopy(city);
    const metadata = studioMetadata(null, copy);
    titles.add(metadata.title);
    descriptions.add(metadata.description);
    assert.ok(metadata.title.includes(city.name.replace(" am Neckar", "")), city.slug);
    assert.ok(metadata.description.includes(cityPickupPriceText(city)), city.slug);
    assert.deepEqual(
      [city.km, city.minutes, cityPickupPriceText(city).replace(/\u00a0/g, " ")],
      confirmed[city.slug],
      city.slug,
    );
    assert.ok(cityJourneyText(city).includes(String(city.minutes)), city.slug);
    assert.equal(publicSeo(`/abholservice/${city.slug}`).status, "index", city.slug);
    for (const service of services) {
      assert.equal(
        serviceCitySeo(service.slug, city.slug).status,
        service.pendingApproval ? "redirect" : "noindex",
        `${service.slug}/${city.slug}`,
      );
    }
  }
  assert.equal(titles.size, 19);
  assert.equal(descriptions.size, 19);
});
