import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cities, services } from "../data/site.ts";
import { serviceBookingSelection } from "./booking-selection.ts";
import {
  filterIndexableSitemap,
  hasLocalSeoEvidence,
  publicSeo,
  seoRobots,
  serviceCitySeo,
  serviceAreaLink,
  pickupAreaLink,
  type LocalSeoEvidence,
} from "./seo-policy.ts";

const inventory = readFileSync(new URL("../data/sitemap-static.xml", import.meta.url), "utf8");
const evidence: LocalSeoEvidence = {
  reviewedOn: "2026-09-27",
  available: true,
  demand: {
    kind: "gsc",
    query: "test combination",
    value: 1,
    period: "test period",
    reference: "synthetic fixture, not production evidence",
  },
  facts: [
    { text: "test fact one", reference: "fixture" },
    { text: "test fact two", reference: "fixture" },
  ],
  proof: { label: "Synthetic proof", url: "https://example.com/test-proof", kind: "photo" },
};

test("all 130 combinations have one decision; unavailable services redirect without chains", () => {
  const decisions = services.flatMap((service) =>
    cities.map((city) => serviceCitySeo(service.slug, city.slug)),
  );
  assert.equal(decisions.length, 130);
  assert.equal(decisions.filter((d) => d.status === "noindex").length, 117);
  assert.equal(decisions.filter((d) => d.status === "redirect").length, 13);
  for (const decision of decisions)
    if (decision.status === "redirect") {
      assert.notEqual(publicSeo(decision.target).status, "redirect");
      assert.equal(decision.target, "/leistungen/scheinwerferaufbereitung");
    }
});

test("index requires demand AND two distinct facts AND public proof AND availability", () => {
  assert.equal(hasLocalSeoEvidence(evidence), true);
  for (const incomplete of [
    undefined,
    { ...evidence, facts: [evidence.facts[0]] },
    { ...evidence, facts: [evidence.facts[0], evidence.facts[0]] },
    { ...evidence, demand: { ...evidence.demand, value: 0 } },
    { ...evidence, proof: { ...evidence.proof, url: "javascript:alert(1)" } },
    { ...evidence, reviewedOn: "unverified" },
  ])
    assert.equal(hasLocalSeoEvidence(incomplete), false);
  const approved = {
    "keramikversiegelung/nagold": evidence,
    "scheinwerferaufbereitung/nagold": evidence,
  };
  assert.equal(serviceCitySeo("keramikversiegelung", "nagold", approved).status, "index");
  assert.equal(serviceCitySeo("scheinwerferaufbereitung", "nagold", approved).status, "redirect");
  assert.equal(serviceCitySeo("unknown", "nagold", approved).status, "noindex");
});

test("sitemap, robots and links agree and cannot override noindex", () => {
  const filtered = filterIndexableSitemap(inventory);
  assert.equal([...filtered.matchAll(/<loc>/g)].length, 48);
  assert.doesNotMatch(
    filtered,
    /scheinwerferaufbereitung|\/impressum|\/datenschutz|\/agb|\/widerruf|\/barrierefreiheit|\/datenloeschung/,
  );
  for (const [, loc] of filtered.matchAll(/<loc>([^<]+)<\/loc>/g))
    assert.equal(publicSeo(new URL(loc).pathname).status, "index");
  assert.equal(
    seoRobots("/leistungen/keramikversiegelung/nagold", "index,follow"),
    "noindex,follow",
  );
  assert.equal(seoRobots("/", "noindex,nofollow"), "noindex,nofollow");
  assert.match(seoRobots("/preise"), /^index,follow/);
  assert.equal(serviceAreaLink("keramikversiegelung", "nagold").to, "/leistungen/$slug");
  const details = serviceAreaLink("keramikversiegelung", "nagold");
  assert.equal(details.search?.ort, "nagold");
  assert.equal(serviceBookingSelection("keramikversiegelung", details.search?.ort).ort, "nagold");
  assert.equal(pickupAreaLink("keramikversiegelung", "nagold").to, "/abholservice/$city");
  for (const loc of [
    "https://other.example/",
    "https://white-gloss.de/preise?test=1",
    "https://white-gloss.de/preise/",
  ]) {
    assert.doesNotMatch(
      filterIndexableSitemap(`<urlset><url><loc>${loc}</loc></url></urlset>`),
      /<loc>/,
    );
  }
});
