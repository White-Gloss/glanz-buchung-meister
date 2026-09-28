import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cities,
  extraIncluded,
  extras,
  faqs,
  openingHours,
  packageSearchAlias,
  packages,
  paymentNote,
  pickupPricing,
  services,
  site,
  timeSlots,
  vehicleClasses,
} from "../src/data/site.ts";

/**
 * The Cowork plugin `white-gloss-anfragen` quotes prices and answers customer
 * questions from this snapshot of src/data/site.ts, so its drafts match the
 * website calculator. scripts/cowork-plugin.test.mjs fails as soon as the
 * snapshot is stale; regenerate it with `npm run cowork:data`.
 */
export const DATA_FILE = fileURLToPath(
  new URL(
    "../plugins/white-gloss-anfragen/skills/angebot-kalkulieren/references/website-daten.json",
    import.meta.url,
  ),
);

export function buildWebsiteData() {
  return {
    _hinweis:
      "Automatisch aus src/data/site.ts erzeugt – nicht von Hand ändern. Neu erzeugen: npm run cowork:data",
    company: {
      legalName: site.legalName,
      owner: site.owner,
      street: site.street,
      postalCode: site.postalCode,
      city: site.city,
      phoneDisplay: site.phoneDisplay,
      email: site.email,
      bookingEmail: site.bookingEmail,
      website: site.origin,
      bookingUrl: `${site.origin}/#buchung`,
    },
    vatRate: site.vatRate,
    vatNote: site.vatNote,
    openingHours: {
      daysLabel: openingHours.daysLabel,
      opens: openingHours.opens,
      closes: openingHours.closes,
    },
    dropOffTimes: timeSlots,
    paymentNote,
    vehicleClasses,
    packages: packages.map(
      ({ id, name, kicker, body, price, duration, items, includesPickup }) => ({
        id,
        name,
        kicker,
        body,
        price,
        duration,
        items,
        includesPickup: includesPickup === true,
      }),
    ),
    packageAliases: packageSearchAlias,
    extras,
    includedExtras: Object.fromEntries(
      packages.map((pack) => [
        pack.id,
        extras.filter((extra) => extraIncluded(pack.id, extra.id)).map((extra) => extra.id),
      ]),
    ),
    pickup: pickupPricing,
    cities: cities.map(({ slug, name, km, minutes }) => ({ slug, name, km, minutes })),
    services: services.map(
      ({
        slug,
        title,
        teaser,
        fromPrice,
        pendingApproval,
        bullets,
        body,
        priceRows,
        honestNote,
      }) => ({
        slug,
        title,
        teaser,
        fromPrice,
        pendingApproval,
        bullets,
        body,
        priceRows,
        honestNote,
      }),
    ),
    faqs,
  };
}

export function serializeWebsiteData() {
  return JSON.stringify(buildWebsiteData(), null, 2) + "\n";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, serializeWebsiteData());
  console.log(`[cowork] Website-Daten für das Plugin geschrieben: ${DATA_FILE}`);
}
