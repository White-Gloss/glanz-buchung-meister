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
const robots = readFileSync(new URL("../../public/robots.txt", import.meta.url), "utf8");

// Test the ASCII path rules used by this file, not a general-purpose REP parser.
// Google: longest matching rule wins, with Allow winning equally specific rules.
// https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
function crawlerAllowed(source: string, path: string) {
  const rules = [...source.matchAll(/^(Allow|Disallow):\s*(\S+)/gim)]
    .map(([, directive, rule]) => {
      const anchored = rule.endsWith("$");
      const pattern = (anchored ? rule.slice(0, -1) : rule)
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      return {
        allowed: directive.toLowerCase() === "allow",
        specificity: rule.replace(/\*+$/, "").length,
        matches: new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(path),
      };
    })
    .filter((rule) => rule.matches)
    .sort((a, b) => b.specificity - a.specificity || Number(b.allowed) - Number(a.allowed));
  return rules[0]?.allowed ?? true;
}

test("crawler path fixture follows Google's specificity and wildcard examples", () => {
  assert.equal(crawlerAllowed("Allow: /p\nDisallow: /", "/page"), true);
  assert.equal(crawlerAllowed("Disallow: /folder\nAllow: /folder", "/folder/page"), true);
  assert.equal(crawlerAllowed("Allow: /page\nDisallow: /*.htm", "/page.htm"), false);
  assert.equal(crawlerAllowed("Allow: /page\nDisallow: /*.ph", "/page.php5"), true);
  assert.equal(crawlerAllowed("Allow: /$\nDisallow: /", "/page.htm"), false);
  assert.equal(crawlerAllowed("Allow: /$\nDisallow: /", "/"), true);
});

test("robots allows published Studio images while previews and private APIs remain blocked", () => {
  // Keep this fixture honest if crawler-specific groups are introduced later.
  assert.deepEqual([...robots.matchAll(/^User-agent:\s*(\S+)/gim)].map((match) => match[1]), ["*"]);
  const image = "/api/studio-media/12345678-1234-4123-8123-123456789abc";
  for (const [path, allowed] of [
    ["/", true],
    ["/galerie", true],
    [image, true],
    [`${image}?preview=1`, false],
    [`${image}?version=2&preview=1`, false],
    [`${image}?download=1`, false],
    ["/api/studio-media-upload", false],
    ["/api/operator", false],
    ["/api/ro-photo?id=private-photo", false],
    ["/api/availability", false],
    ["/admin/website-studio", false],
    ["/login", false],
  ] as const) {
    assert.equal(crawlerAllowed(robots, path), allowed, path);
    // REP precedence must not accidentally depend on directive order.
    assert.equal(crawlerAllowed(robots.split(/\r?\n/).reverse().join("\n"), path), allowed, path);
  }
});

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

test("all service-city combinations have one decision; unavailable services redirect without chains", () => {
  const decisions = services.flatMap((service) =>
    cities.map((city) => serviceCitySeo(service.slug, city.slug)),
  );
  assert.equal(decisions.length, services.length * cities.length);
  assert.equal(decisions.filter((d) => d.status === "noindex").length, services.filter((s) => !s.pendingApproval).length * cities.length);
  assert.equal(decisions.filter((d) => d.status === "redirect").length, services.filter((s) => s.pendingApproval).length * cities.length);
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
  assert.equal([...filtered.matchAll(/<loc>/g)].length, 54);
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
  assert.equal(
    pickupAreaLink("keramikversiegelung", "nagold").search?.leistung,
    "keramikversiegelung",
  );
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

