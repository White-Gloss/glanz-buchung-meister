import assert from "node:assert/strict";
import { test } from "node:test";
import { cities, services } from "../src/data/site.ts";
import { serviceCitySeo } from "../src/lib/seo-policy.ts";

// Run against the production preview, never submit forms or modify data.
const base = process.env.FRONTEND_BASE_URL || "http://127.0.0.1:8081";
async function get(path, headers = {}) {
  const response = await fetch(new URL(path, base), {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  return { response, html: await response.text() };
}
function canonicalLinks(html) {
  return [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)].map(
    ([tag]) => tag.match(/href="([^"]+)"/)?.[1],
  );
}

test("service index and city routes render distinct content with one canonical", async () => {
  for (const [path, heading] of [
    [
      "/leistungen/keramikversiegelung",
      "Keramikversiegelung &amp; Langzeitschutz in Horb",
    ],
    ["/leistungen/keramikversiegelung/nagold", "Keramikversiegelung für Fahrzeuge aus Nagold"],
    [
      "/leistungen/keramikversiegelung/horb-am-neckar",
      "Keramikversiegelung mit Abholung in Horb am Neckar",
    ],
  ]) {
    const { response, html } = await get(path);
    assert.equal(response.status, 200, path);
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, "");
    assert.equal(h1, heading, `${path} must render its own heading`);
    assert.deepEqual(canonicalLinks(html), [`https://white-gloss.de${path}`], path);
    assert.match(html, /<html[^>]*lang="de"/);
    assert.ok(html.includes(`property="og:url" content="https://white-gloss.de${path}"`));
  }
});

test("all published service/city combinations render their own route", async () => {
  assert.ok(services.length > 0 && cities.length > 0);
  for (const service of services) {
    for (const city of cities) {
      const path = `/leistungen/${service.slug}/${city.slug}`;
      const { response, html } = await get(path);
      const seo = serviceCitySeo(service.slug, city.slug);
      if (seo.status === "redirect") {
        assert.equal(response.status, 301, path);
        assert.equal(new URL(response.headers.get("location"), base).pathname, seo.target);
        continue;
      }
      assert.equal(response.status, 200, path);
      const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, "");
      const expectedHeading =
        city.slug === "horb-am-neckar"
          ? `${service.seoNav} mit Abholung in ${city.name}`
          : `${service.seoNav} für Fahrzeuge aus ${city.name}`;
      assert.equal(h1, expectedHeading, path);
      assert.deepEqual(canonicalLinks(html), [`https://white-gloss.de${path}`], path);
    }
  }
});

test("unknown services and cities preserve real 404 responses", async () => {
  for (const path of [
    "/leistungen/nicht-vorhanden",
    "/leistungen/keramikversiegelung/nicht-vorhanden",
  ]) {
    const { response } = await get(path);
    assert.equal(response.status, 404, path);
  }
});

test("city context survives consolidated details and both booking destinations", async () => {
  const { html: city } = await get("/abholservice/nagold");
  assert.match(city, /href="\/leistungen\/keramikversiegelung\?ort=nagold"/);
  for (const [slug, destination] of [
    ["keramikversiegelung", "/"],
    ["lederreparatur", "/fahrzeug-zustand"],
  ]) {
    const { response, html } = await get(`/leistungen/${slug}?ort=nagold`);
    assert.equal(response.status, 200);
    assert.deepEqual(canonicalLinks(html), [`https://white-gloss.de/leistungen/${slug}`]);
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    const links = [...main.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const cta = links.find(([, , text]) => text.includes("Termin anfragen"));
    assert.ok(cta, slug);
    const target = new URL(cta[1].replaceAll("&amp;", "&"), base);
    assert.equal(target.pathname, destination);
    assert.equal(target.searchParams.get("ort"), "nagold");
    assert.equal(target.hash, "#buchung");
  }
  const { html } = await get("/leistungen/keramikversiegelung?ort=unknown-city");
  assert.doesNotMatch(html, /href="[^"]*ort=unknown-city/);
});

test("selected service survives the indexable pickup hub before booking", async () => {
  for (const [slug, destination, key, value] of [
    ["keramikversiegelung", "/", "paket", "keramik"],
    ["lederreparatur", "/fahrzeug-zustand", "leistung", "lederreparatur"],
  ]) {
    const { html: service } = await get(`/leistungen/${slug}`);
    assert.ok(service.includes(`/abholservice/nagold?leistung=${slug}`));
    const { response, html } = await get(`/abholservice/nagold?leistung=${slug}`);
    assert.equal(response.status, 200);
    assert.deepEqual(canonicalLinks(html), ["https://white-gloss.de/abholservice/nagold"]);
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    const cta = [...main.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].find(
      ([, , text]) => text.includes("Termin anfragen"),
    );
    assert.ok(cta, slug);
    const target = new URL(cta[1].replaceAll("&amp;", "&"), base);
    assert.equal(target.pathname, destination);
    assert.equal(target.searchParams.get("ort"), "nagold");
    assert.equal(target.searchParams.get(key), value);
  }
});

test("public route metadata survives the PWA injector", async () => {
  const { html } = await get("/preise");
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title);
  assert.ok(html.includes(`property="og:title" content="${title}"`));
  assert.match(html, /property="og:description" content="[^"]+"/);
  assert.match(html, /property="og:type" content="website"/);
  assert.match(html, /rel="manifest"/);
  const { html: login } = await get("/login");
  assert.match(login, /name="robots" content="noindex/);
});

test("Node serves compressed build assets and revalidates mutable media", async () => {
  const { html } = await get("/");
  const css = html.match(/href="(\/assets\/public-[^"]+\.css)"/)?.[1];
  assert.ok(css, "the production document must reference the bundled global stylesheet");
  const { response, html: stylesheet } = await get(css, { "accept-encoding": "gzip" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-encoding"), "gzip");
  assert.match(response.headers.get("cache-control") || "", /immutable/);
  assert.ok(stylesheet.length > 1000, "the compressed stylesheet must decode successfully");
  for (const path of ["/media/lack-1200.avif", "/fonts/barlow-300.woff2"]) {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, path);
    assert.doesNotMatch(response.headers.get("cache-control") || "", /immutable/, path);
    assert.match(response.headers.get("cache-control") || "", /max-age=604800/, path);
    await response.arrayBuffer();
  }
  {
    const path = "/__grok/manifest.webmanifest";
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, path);
    assert.doesNotMatch(response.headers.get("cache-control") || "", /immutable/, path);
    assert.match(response.headers.get("cache-control") || "", /(?:must-revalidate|no-cache)/, path);
    await response.arrayBuffer();
  }
});
