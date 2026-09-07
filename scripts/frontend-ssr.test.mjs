import assert from "node:assert/strict";
import { test } from "node:test";
import { cities, services } from "../src/data/site.ts";

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
    ["/leistungen/keramikversiegelung", "Keramikversiegelung"],
    ["/leistungen/keramikversiegelung/nagold", "Ceramic Gloss in Nagold"],
    ["/leistungen/keramikversiegelung/horb-am-neckar", "Ceramic Gloss in Horb am Neckar"],
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
      assert.equal(response.status, 200, path);
      const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, "");
      assert.equal(h1, `${service.nav} in ${city.name}`, path);
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
  const css = html.match(/href="(\/assets\/styles-[^"]+\.css)"/)?.[1];
  assert.ok(css, "the production document must reference the built stylesheet");
  const { response, html: stylesheet } = await get(css, { "accept-encoding": "gzip" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-encoding"), "gzip");
  assert.match(response.headers.get("cache-control") || "", /immutable/);
  assert.ok(stylesheet.length > 1000, "the compressed stylesheet must decode successfully");
  for (const path of [
    "/media/lack-1200.avif",
    "/fonts/barlow-300.woff2",
    "/__grok/manifest.webmanifest",
  ]) {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, path);
    assert.doesNotMatch(response.headers.get("cache-control") || "", /immutable/, path);
    assert.match(response.headers.get("cache-control") || "", /(?:must-revalidate|no-cache)/, path);
    await response.arrayBuffer();
  }
});
