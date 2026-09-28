import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  berechne,
  findCity,
  findExtra,
  findPackage,
  formatEuro,
  loadData,
} from "../plugins/white-gloss-anfragen/skills/angebot-kalkulieren/scripts/angebot.mjs";
import {
  cities,
  extras,
  packageSearchAlias,
  packages,
  quoteTotal,
  vehicleClasses,
} from "../src/data/site.ts";
import { eur } from "../src/lib/utils.ts";
import { DATA_FILE, serializeWebsiteData } from "./cowork-plugin-data.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const pluginDir = join(repoRoot, "plugins/white-gloss-anfragen");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

describe("Cowork plugin white-gloss-anfragen", () => {
  it("ships website data that matches src/data/site.ts", () => {
    assert.deepEqual(
      readJson(DATA_FILE),
      JSON.parse(serializeWebsiteData()),
      "Plugin data is stale – run `npm run cowork:data` and commit the result.",
    );
  });

  it("quotes exactly like the website calculator", () => {
    const data = loadData();
    const bookable = extras.filter((e) => e.requestable !== false).map((e) => e.id);
    const selections = [[], bookable, ...bookable.map((id) => [id])];
    for (let mask = 1; mask < 1 << bookable.length; mask += 97) {
      selections.push(bookable.filter((_, bit) => mask & (1 << bit)));
    }
    let checked = 0;
    for (const pack of packages) {
      for (const klass of vehicleClasses) {
        for (const extraIds of selections) {
          for (const citySlug of [undefined, ...cities.map((c) => c.slug)]) {
            const expected = quoteTotal({
              packageId: pack.id,
              classId: klass.id,
              extraIds,
              citySlug,
            });
            const actual = berechne(data, {
              paket: pack.id,
              klasse: klass.id,
              extras: extraIds,
              ort: citySlug,
            });
            const label = `${pack.id}/${klass.id}/${extraIds.join("+") || "-"}/${citySlug ?? "-"}`;
            assert.equal(actual.gesamtCent, Math.round(expected.total * 100), label);
            assert.equal(actual.abholungAufAnfrage, expected.pickupOnRequest, label);
            checked += 1;
          }
        }
      }
    }
    assert.ok(checked > 1000);
  });

  it("does not price extras that cannot be requested", () => {
    const data = loadData();
    const blocked = extras.find((e) => e.requestable === false);
    assert.ok(blocked, "expected at least one non-requestable extra");
    const result = berechne(data, { paket: "basis", klasse: "kompakt", extras: [blocked.id] });
    assert.equal(result.gesamtCent, packages.find((p) => p.id === "basis").price * 100);
    assert.ok(result.hinweise.some((h) => h.startsWith(blocked.name)));
  });

  it("formats amounts like the website", () => {
    for (const value of [0, 50, 99, 149, 153.45, 436.25, 1123.75, 1393.45, 2786.9, 12345]) {
      assert.equal(formatEuro(value), eur(value).replace(" ", " "));
    }
  });

  it("understands the names the website and customers use", () => {
    const data = loadData();
    for (const [alias, id] of Object.entries(packageSearchAlias)) {
      assert.equal(findPackage(data, alias)?.id, id, alias);
    }
    for (const pack of packages) assert.equal(findPackage(data, pack.name)?.id, pack.id);
    for (const extra of extras) assert.equal(findExtra(data, extra.name)?.id, extra.id);
    for (const city of cities) assert.equal(findCity(data, city.name)?.slug, city.slug);
    assert.equal(findCity(data, "Horb")?.slug, "horb-am-neckar");
  });

  it("keeps manifest and marketplace entry consistent", () => {
    const manifest = readJson(join(pluginDir, ".claude-plugin/plugin.json"));
    assert.match(manifest.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
    const marketplace = readJson(join(repoRoot, ".claude-plugin/marketplace.json"));
    const entry = marketplace.plugins.find((p) => p.name === manifest.name);
    assert.ok(entry, "plugin missing from .claude-plugin/marketplace.json");
    assert.equal(resolve(repoRoot, entry.source), pluginDir);
    assert.equal(entry.version, manifest.version);
  });

  it("has loadable skills whose file references exist", () => {
    const skillsDir = join(pluginDir, "skills");
    const skills = readdirSync(skillsDir);
    assert.deepEqual(skills.sort(), ["anfrage-beantworten", "angebot-kalkulieren"]);
    for (const skill of skills) {
      const skillDir = join(skillsDir, skill);
      const text = readFileSync(join(skillDir, "SKILL.md"), "utf8");
      const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
      assert.ok(frontmatter, `${skill}: missing frontmatter`);
      const fields = Object.fromEntries(
        frontmatter
          .split("\n")
          .map((line) => [
            line.slice(0, line.indexOf(":")),
            line.slice(line.indexOf(":") + 1).trim(),
          ]),
      );
      assert.equal(fields.name, skill);
      assert.ok(fields.description.length > 0 && fields.description.length <= 1024, skill);
      // Unquoted YAML scalars break on ": " and " #".
      assert.ok(
        !/: | #/.test(fields.description),
        `${skill}: description is not a plain YAML scalar`,
      );

      const markdown = [join(skillDir, "SKILL.md")];
      if (existsSync(join(skillDir, "references"))) {
        for (const name of readdirSync(join(skillDir, "references"))) {
          if (name.endsWith(".md")) markdown.push(join(skillDir, "references", name));
        }
      }
      for (const file of markdown) {
        const content = readFileSync(file, "utf8");
        for (const [, path] of content.matchAll(/`((?:\.\.\/|references\/|scripts\/)[^`\s]+)`/g)) {
          assert.ok(existsSync(resolve(skillDir, path)), `${file}: ${path} does not exist`);
        }
      }
    }
  });

  it("offers every data field the skills refer to", () => {
    const data = loadData();
    for (const key of [
      "owner",
      "legalName",
      "street",
      "postalCode",
      "city",
      "phoneDisplay",
      "bookingEmail",
      "website",
      "bookingUrl",
    ]) {
      assert.ok(data.company[key], `company.${key}`);
    }
    assert.ok(
      data.openingHours.daysLabel && data.dropOffTimes.length && data.paymentNote && data.vatNote,
    );
    assert.ok(data.packages.every((p) => p.duration));
    assert.ok(data.pickup.freeWithPackageId in data.includedExtras && data.pickup.freeUpToKm > 0);
    const service = (slug) => data.services.find((s) => s.slug === slug);
    assert.ok(service("lederreparatur").priceRows.length && service("lederreparatur").honestNote);
    assert.ok(service("leasingrueckgabe").fromPrice > 0);
    assert.ok(
      service("scheinwerferaufbereitung").pendingApproval &&
        service("scheinwerferaufbereitung").honestNote,
    );
    assert.ok(
      data.faqs.some((f) => /versichert/i.test(f.q)),
      "insurance FAQ",
    );
    assert.ok(data.extras.some((e) => e.inspect));
  });
});
