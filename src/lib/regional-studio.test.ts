import assert from "node:assert/strict";
import { test } from "node:test";
import { cities, cityPickupPriceText, services, site } from "../data/site.ts";
import { cityJourneyText, citySeoCopy } from "./city-copy.ts";
import { cityPlanningText, cityLogisticsFaq } from "./city-logistics.ts";
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

test("all 19 pickup plans add useful information without repeating the introduction or losing local handover notes", () => {
  const plans = cities.map((city) => cityPlanningText(city));
  assert.equal(new Set(plans).size, 19);
  for (const city of cities) {
    const plan = cityPlanningText(city);
    assert.ok(plan.length > 100, city.slug);
    assert.ok(!plan.includes(city.blurb), `${city.slug}: do not repeat the hero introduction`);
    if (city.pickupNote) assert.equal(plan, city.pickupNote, city.slug);
    else assert.ok(plan.includes(cityPickupPriceText(city)), city.slug);
  }
  assert.equal(cities.filter((city) => city.pickupNote).length, 6);
  const nagold = cities.find((city) => city.slug === "nagold")!;
  const changedLogistics = { ...nagold, km: 25, minutes: 32 };
  const changedPlan = cityPlanningText(changedLogistics);
  assert.ok(changedPlan.includes(`${changedLogistics.km} km`));
  assert.ok(changedPlan.includes(`${changedLogistics.minutes} Minuten`));
  assert.ok(changedPlan.includes(cityPickupPriceText(changedLogistics)));
});

test("planning paragraphs and logistics FAQs for all 19 cities have no doubled sentence punctuation", () => {
  for (const city of cities) {
    const faq = cityLogisticsFaq(city);
    for (const text of [cityPlanningText(city), faq?.question, faq?.answer]) {
      if (text) assert.doesNotMatch(text, /\.\s*\./, city.slug);
    }
    assert.match(cityJourneyText(city), /Min\.$/, "Compact distance labels retain their abbreviation");
  }
});

test("specific logistics FAQs explain free pickup and radius boundaries without changing package prices", () => {
  const faqSlugs = cities.filter((city) => cityLogisticsFaq(city)).map((city) => city.slug).sort();
  assert.deepEqual(faqSlugs, ["boeblingen", "empfingen", "horb-am-neckar", "reutlingen", "sindelfingen"]);
  for (const slug of faqSlugs) {
    const city = cities.find((entry) => entry.slug === slug)!;
    const faq = cityLogisticsFaq(city)!;
    assert.ok(faq.question.endsWith("?"), slug);
    assert.ok(faq.answer.includes(cityPickupPriceText(city)), slug);
    if (["boeblingen", "reutlingen", "sindelfingen"].includes(slug)) {
      assert.ok(faq.answer.includes(cityPickupPriceText(city, "keramik")), slug);
      assert.match(faq.answer, /White-Gloss Classic und White-Gloss Signature/);
      assert.ok(faq.answer.includes(`${city.km} km`), slug);
    }
  }
  const horb = cities.find((city) => city.slug === "horb-am-neckar")!;
  assert.ok(cityLogisticsFaq(horb)!.answer.includes(site.street));
  const empfingen = cities.find((city) => city.slug === "empfingen")!;
  assert.match(cityLogisticsFaq(empfingen)!.answer, /Wiesenstetten.*Dommelsberg/);
});
