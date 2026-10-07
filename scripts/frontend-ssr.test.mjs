import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
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

function executableInlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(([, attributes, source]) => {
      if (/\bsrc\s*=/i.test(attributes) || !source.trim()) return false;
      const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase();
      return !type || ["module", "text/javascript", "application/javascript"].includes(type);
    });
}

test("production SSR nonces match streamed scripts on successful and 404 documents", async () => {
  const nonces = new Set();
  for (const path of ["/", "/", "/preise", "/leistungen/nicht-vorhanden"]) {
    const { response, html } = await get(path, { "x-forwarded-host": "white-gloss.de" });
    assert.equal(response.status, path.includes("nicht-vorhanden") ? 404 : 200);
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains; preload");
    const csp = response.headers.get("content-security-policy");
    const scriptSrc = csp?.split(";").find((part) => part.trim().startsWith("script-src"));
    assert.ok(scriptSrc && !scriptSrc.includes("'unsafe-inline'"));
    const nonce = scriptSrc.match(/'nonce-([A-Za-z0-9+/]{43}=)'/)?.[1];
    assert.ok(nonce, "SSR needs a fresh request nonce");
    assert.ok(!nonces.has(nonce), "Separate responses must never reuse a nonce");
    nonces.add(nonce);
    const scripts = executableInlineScripts(html);
    assert.ok(scripts.length > 0, "The real streaming bootstrap must be present");
    for (const [, attributes] of scripts) {
      assert.equal(attributes.match(/\bnonce="([^"]+)"/)?.[1], nonce, path);
    }
    const nonceMeta = [...html.matchAll(/<meta\b[^>]*>/g)]
      .map(([tag]) => tag)
      .find((tag) => /\bproperty="csp-nonce"/.test(tag));
    assert.equal(nonceMeta?.match(/\bcontent="([^"]+)"/)?.[1], nonce, "Hydration must restore the same nonce");
    assert.doesNotMatch(html, /grok-app-builder\/extensions\.js/, "Customer documents omit the preview extension");
  }
});

test("production installer authorizes its unchanged static classifier with a hash", async () => {
  const { response, html } = await get("/?install=1&platform=ios", { "x-forwarded-host": "white-gloss.de" });
  assert.equal(response.status, 200);
  const csp = response.headers.get("content-security-policy");
  const scriptSrc = csp?.split(";").find((part) => part.trim().startsWith("script-src"));
  assert.ok(scriptSrc && !scriptSrc.includes("'unsafe-inline'"));
  const scripts = executableInlineScripts(html);
  assert.ok(scripts.length > 0);
  for (const [, , source] of scripts) {
    const digest = createHash("sha256").update(source.replace(/\r\n?/g, "\n"), "utf8").digest("base64");
    assert.ok(scriptSrc.includes(`'sha256-${digest}'`));
  }
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
});

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
  const assetDirectory = new URL("../.output/public/assets/", import.meta.url);
  const stylesheets = await Promise.all(
    (await readdir(assetDirectory))
      .filter((name) => name.endsWith(".css"))
      .map(async (name) => ({
        name,
        source: await readFile(new URL(name, assetDirectory), "utf8"),
      })),
  );
  const globals = stylesheets.filter(({ source }) =>
    source.includes("--color-bg:") && source.includes("@font-face"),
  );
  assert.equal(globals.length, 1, "the build must contain one complete global stylesheet");
  for (const path of [
    "/",
    "/preise",
    "/leistungen/keramikversiegelung",
    "/leistungen/keramikversiegelung/nagold",
    "/fahrzeug-zustand",
    "/galerie",
    "/qualitaet",
    "/kontakt",
    "/impressum",
    "/datenschutz",
  ]) {
    const { response, html } = await get(path);
    assert.equal(response.status, 200, path);
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)?.[1] || "";
    const inlineCss = [...head.matchAll(/<style\b(?=[^>]*data-tsr-inline-css)[^>]*>([\s\S]*?)<\/style>/g)]
      .map(([, css]) => css)
      .join("");
    assert.ok(
      inlineCss.includes(globals[0].source.trim()),
      `${path} must inline the complete generated global CSS before the body, also without JavaScript`,
    );
    assert.doesNotMatch(
      head,
      /<link\b[^>]*rel="stylesheet"/,
      `${path} must inline its initial route styles through Start`,
    );
    assert.doesNotMatch(
      head,
      /<link\b[^>]*rel="modulepreload"/,
      `${path} leaves hydration preloads to the deferred bootstrap`,
    );
    assert.doesNotMatch(
      html,
      /<script\b[^>]*\bsrc="\/assets\//,
      `${path} must not fetch the client entry before the first viewport has painted`,
    );
    const bootstraps = executableInlineScripts(html).filter(([, , source]) =>
      source.includes('t.type="module"'),
    );
    assert.equal(bootstraps.length, 1, `${path} must start hydration through one deferred bootstrap`);
    const [, , bootstrap] = bootstraps[0];
    const lists = bootstrap.match(/\}\)\(document,window,(\[[^\]]*\]),(\[[^\]]*\])\)$/);
    assert.ok(lists, `${path} bootstrap must end with its entry and preload lists`);
    const [entries, preloads] = [JSON.parse(lists[1]), JSON.parse(lists[2])];
    assert.ok(entries.length > 0 && preloads.length > 0, `${path} must retain Start's hydration assets`);
    for (const asset of [...entries, ...preloads]) {
      assert.match(asset, /^\/assets\/[\w.-]+\.js$/, `${path} hydration asset ${asset}`);
      const response = await fetch(new URL(asset, base), { signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200, `${path} hydration asset ${asset}`);
      await response.arrayBuffer();
    }
  }
  const css = `/assets/${globals[0].name}`;
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
