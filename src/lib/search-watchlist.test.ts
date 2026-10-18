import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cities, defaultRequestDetails, services, type ServicePage } from "../data/site.ts";
import { watchedSearchTerms } from "../data/search-watchlist.ts";
import { citySeoCopy } from "./city-copy.ts";
import { seoIntents } from "./seo-intents.ts";

// Hyphenated compounds ("Kfz-Pflege", "Auto-Innenreinigung") count as the spaced search term.
const normalize = (text: string) => text.toLowerCase().replace(/[-­]/g, "");
const tokens = (term: string) => normalize(term).split(/\s+/).filter(Boolean);
const containsTerm = (text: string, term: string) =>
  tokens(term).every((token) => normalize(text).includes(token));

function serviceCopy(s: ServicePage) {
  return [
    s.metaTitle,
    s.title,
    s.description,
    s.teaser,
    ...s.bullets,
    ...s.body,
    ...(s.steps ?? []).flatMap((step) => [step.title, step.text]),
    s.honestNote ?? "",
    ...(s.suitedFor ?? []),
    s.outcome ?? "",
    ...(s.comparison
      ? [s.comparison.heading, ...s.comparison.items.flatMap((item) => [item.name, item.text])]
      : []),
    ...(s.beforeBooking ?? []),
    ...(s.requestDetails ?? defaultRequestDetails),
  ].join(" ");
}

/** Pages whose copy lives in JSX are checked against their route source. */
const routeSources: Record<string, string> = {
  "/": "../routes/index.tsx",
  "/leistungen": "../routes/leistungen.index.tsx",
};

function pageCopy(path: string): { snippet: string; full: string; fromData: boolean } {
  const service = services.find((s) => `/leistungen/${s.slug}` === path);
  if (service) {
    return {
      snippet: `${service.metaTitle} ${service.description}`,
      full: serviceCopy(service),
      fromData: true,
    };
  }
  const city = cities.find((c) => `/abholservice/${c.slug}` === path);
  if (city) {
    const copy = citySeoCopy(city);
    return {
      snippet: `${copy.title} ${copy.description}`,
      full: [copy.title, copy.heading, copy.description, city.blurb, city.pickupNote ?? ""].join(" "),
      fromData: true,
    };
  }
  const source = routeSources[path];
  assert.ok(source, `no copy source for ${path}`);
  const text = readFileSync(new URL(source, import.meta.url), "utf8");
  return { snippet: text, full: text, fromData: false };
}

test("each watched term belongs to exactly one indexable page", () => {
  const terms = watchedSearchTerms.map((entry) => entry.term);
  assert.equal(new Set(terms).size, terms.length, "a term must not be assigned twice");
  assert.equal(terms.length, 14);
  for (const entry of watchedSearchTerms) {
    assert.ok(seoIntents[entry.path], `${entry.term}: ${entry.path} is not an indexable page`);
  }
  for (const path of new Set(watchedSearchTerms.map((entry) => entry.path))) {
    const primaries = watchedSearchTerms.filter((e) => e.path === path && e.role === "primary");
    assert.equal(primaries.length, 1, `${path} needs exactly one primary term`);
  }
});

test("primary terms appear in the title or description of their page", () => {
  for (const entry of watchedSearchTerms.filter((e) => e.role === "primary")) {
    assert.ok(containsTerm(pageCopy(entry.path).snippet, entry.term), `${entry.path}: ${entry.term}`);
  }
});

test("related terms appear in the visible copy of their page", () => {
  for (const entry of watchedSearchTerms.filter((e) => e.role === "related")) {
    assert.ok(containsTerm(pageCopy(entry.path).full, entry.term), `${entry.path}: ${entry.term}`);
  }
});

test("watched terms are not stuffed into page copy", () => {
  for (const entry of watchedSearchTerms) {
    const copy = pageCopy(entry.path);
    if (!copy.fromData) continue;
    const occurrences = normalize(copy.full).split(normalize(entry.term)).length - 1;
    assert.ok(occurrences <= 4, `${entry.path}: "${entry.term}" appears ${occurrences} times`);
  }
});
