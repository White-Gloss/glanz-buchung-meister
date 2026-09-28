#!/usr/bin/env node
/**
 * Richtpreis wie der Online-Rechner auf white-gloss.de (quoteTotal in src/data/site.ts):
 *
 *   (Paket + Extras, die nicht im Paket enthalten sind) × Klassenfaktor + Hol- und Bringservice
 *
 * Liest nur ../references/website-daten.json und braucht keine weiteren Pakete.
 *
 *   node angebot.mjs --paket keramik --klasse suv --extras ozon,tierhaar --ort Tübingen
 *   node angebot.mjs --paket basis --klasse kompakt --km 18 --json
 *   node angebot.mjs --liste
 */
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const DATA_URL = new URL("../references/website-daten.json", import.meta.url);

const CLASS_ALIASES = {
  kompaktklasse: "kompakt",
  kompaktwagen: "kompakt",
  kleinwagen: "kompakt",
  limousine: "suv",
  kombi: "suv",
  mittelklasse: "suv",
  van: "transporter",
  bus: "transporter",
  nutzfahrzeug: "transporter",
};

const USAGE = `Richtpreis wie auf white-gloss.de berechnen.

  node angebot.mjs --paket <Paket> --klasse <Klasse> [--extras a,b] [--ort <Ort> | --km <Zahl>] [--json]
  node angebot.mjs --liste

--paket   basis | premium | keramik (auch Paketnamen); weglassen = nur Extras
--klasse  kompakt | suv | transporter
--extras  Extra-IDs oder -Namen, durch Komma getrennt
--ort     Abholort aus der Liste; --km für andere Orte (Straßenkilometer ab Werkstatt)
--json    Ergebnis als JSON statt Markdown
--liste   Pakete, Klassen, Extras, Abholstaffel und Orte anzeigen
`;

export class InputError extends Error {}

export function loadData(url = DATA_URL) {
  return JSON.parse(readFileSync(url, "utf8"));
}

/** "Tübingen" → "tuebingen", "Reinigung & Politur" → "reinigung-politur" */
export function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Wie eur() der Website: Cent nur, wenn der Betrag welche hat. */
export function formatEuro(value) {
  const cents = Math.round(value * 100);
  const abs = Math.abs(cents);
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const rest = abs % 100 ? `,${String(abs % 100).padStart(2, "0")}` : "";
  return `${cents < 0 ? "-" : ""}${euros}${rest} €`;
}

function formatFactor(factor) {
  return String(factor).replace(".", ",");
}

export function findPackage(data, input) {
  const key = normalize(input);
  const alias = Object.entries(data.packageAliases).find(([name]) => normalize(name) === key);
  const id = alias ? alias[1] : key;
  return data.packages.find((p) => p.id === id || normalize(p.name) === key);
}

export function findClass(data, input) {
  const key = normalize(input);
  const id = CLASS_ALIASES[key] ?? key;
  return data.vehicleClasses.find((c) => c.id === id || normalize(c.label) === key);
}

export function findExtra(data, input) {
  const key = normalize(input);
  return data.extras.find((e) => e.id === key || normalize(e.name) === key);
}

export function findCity(data, input) {
  const key = normalize(input);
  const exact = data.cities.find((c) => c.slug === key || normalize(c.name) === key);
  if (exact) return exact;
  const prefixed = data.cities.filter((c) => c.slug.startsWith(`${key}-`));
  return prefixed.length === 1 ? prefixed[0] : undefined;
}

/** Wie pickupFee() der Website: null bedeutet „auf Anfrage“. */
export function pickupFee(data, km, packageId) {
  const { tiers, freeWithPackageId, freeUpToKm } = data.pickup;
  if (packageId === freeWithPackageId && km <= freeUpToKm) return 0;
  for (const tier of [...tiers].sort((a, b) => a.maxKm - b.maxKm)) {
    if (km <= tier.maxKm) return tier.amount;
  }
  return null;
}

function scaled(art, id, name, grundpreis, faktor) {
  return { art, id, name, grundpreis, faktor, betragCent: Math.round(grundpreis * faktor * 100) };
}

/**
 * @param {ReturnType<typeof loadData>} data
 * @param {{ paket?: string, klasse?: string, extras?: string[], ort?: string, km?: number | string }} input
 */
export function berechne(data, { paket, klasse, extras = [], ort, km } = {}) {
  const hinweise = [];
  const pack = paket ? findPackage(data, paket) : undefined;
  if (paket && !pack) {
    const known = data.packages.map((p) => `${p.id} (${p.name})`).join(", ");
    throw new InputError(`Unbekanntes Paket „${paket}“. Möglich: ${known}.`);
  }
  const klass = klasse ? findClass(data, klasse) : undefined;
  if (!klass) {
    const known = data.vehicleClasses.map((c) => `${c.id} (${c.hint})`).join(", ");
    throw new InputError(
      `${klasse ? `Unbekannte Fahrzeugklasse „${klasse}“` : "Fahrzeugklasse fehlt"}. Möglich: ${known}.`,
    );
  }
  if (!pack) {
    hinweise.push(
      "Ohne Paket gerechnet: Auf der Website gibt es Extras nur zusammen mit einem Paket. Ob die Leistung einzeln angeboten wird, entscheidet Lars.",
    );
  }

  const positionen = [];
  if (pack)
    positionen.push(scaled("paket", pack.id, `Paket ${pack.name}`, pack.price, klass.factor));

  const included = new Set(pack ? (data.includedExtras[pack.id] ?? []) : []);
  const seen = new Set();
  for (const raw of extras) {
    const extra = findExtra(data, raw);
    if (!extra) throw new InputError(`Unbekanntes Extra „${raw}“. Alle Extras: --liste`);
    if (seen.has(extra.id)) continue;
    seen.add(extra.id);
    if (extra.requestable === false) {
      hinweise.push(`${extra.name}: nicht berechnet – ${extra.hint}`);
      continue;
    }
    if (included.has(extra.id)) {
      positionen.push({
        art: "extra",
        id: extra.id,
        name: extra.name,
        grundpreis: extra.price,
        faktor: null,
        betragCent: 0,
        hinweis: `im Paket ${pack.name} enthalten`,
      });
      continue;
    }
    const position = scaled("extra", extra.id, extra.name, extra.price, klass.factor);
    if (extra.inspect) {
      position.hinweis = "nach Prüfung";
      hinweise.push(`${extra.name}: Der Preis gilt erst nach Prüfung von Material bzw. Lack.`);
    }
    positionen.push(position);
  }

  let city;
  let distance = km === undefined || km === null || km === "" ? undefined : Number(km);
  if (ort) {
    city = findCity(data, ort);
    if (!city) {
      const known = data.cities.map((c) => `${c.name} (${c.km} km)`).join(", ");
      throw new InputError(
        `„${ort}“ steht nicht in der Abholliste. Entfernung mit --km angeben. Orte: ${known}.`,
      );
    }
    distance = city.km;
  }
  if (distance !== undefined && !(Number.isFinite(distance) && distance >= 0)) {
    throw new InputError(
      `Ungültige Entfernung „${km}“ – erwartet werden Kilometer ab der Werkstatt.`,
    );
  }

  let abholungAufAnfrage = false;
  if (distance !== undefined) {
    const name = `Hol- und Bringservice ${city ? `${city.name}, ` : ""}${distance} km`;
    const fee = pickupFee(data, distance, pack?.id);
    if (fee === null) {
      abholungAufAnfrage = true;
      positionen.push({
        art: "abholung",
        id: null,
        name,
        grundpreis: null,
        faktor: null,
        betragCent: 0,
        hinweis: "auf Anfrage",
      });
      hinweise.push(
        `Abholung aus ${distance} km liegt außerhalb der Staffel: Preis nach Absprache, im Richtpreis nicht enthalten.`,
      );
    } else {
      const inPackage =
        pack?.id === data.pickup.freeWithPackageId && distance <= data.pickup.freeUpToKm;
      positionen.push({
        art: "abholung",
        id: null,
        name,
        grundpreis: fee,
        faktor: null,
        betragCent: Math.round(fee * 100),
        hinweis: inPackage
          ? `im Paket ${pack.name} bis ${data.pickup.freeUpToKm} km enthalten`
          : fee === 0
            ? "kostenlos"
            : undefined,
      });
    }
  }

  const gesamtCent = positionen.reduce((sum, p) => sum + p.betragCent, 0);
  return {
    paket: pack ? { id: pack.id, name: pack.name, duration: pack.duration } : null,
    klasse: { id: klass.id, label: klass.label, hint: klass.hint, factor: klass.factor },
    positionen: positionen.map((p) => ({ ...p, betragText: formatEuro(p.betragCent / 100) })),
    gesamtCent,
    gesamtText: formatEuro(gesamtCent / 100),
    abholungAufAnfrage,
    hinweise,
  };
}

export function formatMarkdown(result, data) {
  const betrag = (p) =>
    p.art === "abholung" && p.hinweis === "auf Anfrage"
      ? "auf Anfrage"
      : p.betragCent === 0 && p.hinweis
        ? p.hinweis
        : `${p.betragText}${p.hinweis ? ` (${p.hinweis})` : ""}`;
  const lines = [
    `**Richtpreis: ${result.gesamtText}**${result.abholungAufAnfrage ? " zzgl. Abholung nach Absprache" : ""} – voraussichtlich, ${data.vatNote}`,
    "",
    `Fahrzeugklasse: ${result.klasse.label} – ${result.klasse.hint} (Faktor ${formatFactor(result.klasse.factor)})`,
    result.paket ? `Paket: ${result.paket.name}, Dauer ${result.paket.duration}` : "Paket: keines",
    "",
    "| Position | Grundpreis Kompaktklasse | Faktor | Betrag |",
    "| --- | ---: | ---: | ---: |",
    ...result.positionen.map(
      (p) =>
        `| ${p.name} | ${p.art === "abholung" || p.grundpreis === null ? "–" : formatEuro(p.grundpreis)} | ${p.faktor ? `× ${formatFactor(p.faktor)}` : "–"} | ${betrag(p)} |`,
    ),
    `| **Gesamt (voraussichtlich)** | | | **${result.gesamtText}** |`,
  ];
  if (result.hinweise.length) lines.push("", "Hinweise:", ...result.hinweise.map((h) => `- ${h}`));
  return lines.join("\n") + "\n";
}

export function formatListe(data) {
  const pad = (value, width) => String(value).padEnd(width);
  const packageName = (id) => data.packages.find((p) => p.id === id)?.name ?? id;
  const pickup = data.pickup;
  const tiers = [...pickup.tiers]
    .sort((a, b) => a.maxKm - b.maxKm)
    .map((t) => `bis ${t.maxKm} km ${t.amount === 0 ? "kostenlos" : formatEuro(t.amount)}`);
  const lines = [
    `Pakete (Preis Kompaktklasse, ${data.vatNote}):`,
    ...data.packages.map(
      (p) => `  ${pad(p.id, 14)}${pad(p.name, 24)}${pad(formatEuro(p.price), 10)}${p.duration}`,
    ),
    "",
    "Fahrzeugklassen:",
    ...data.vehicleClasses.map(
      (c) =>
        `  ${pad(c.id, 14)}${pad(c.label, 24)}${pad(`× ${formatFactor(c.factor)}`, 10)}${c.hint}`,
    ),
    "",
    "Extras (Preis Kompaktklasse, wird mit dem Klassenfaktor multipliziert):",
    ...data.extras.map((e) => {
      const flags = [
        e.inspect ? "nach Prüfung" : "",
        e.requestable === false ? "NICHT BUCHBAR" : "",
        ...Object.entries(data.includedExtras)
          .filter(([, ids]) => ids.includes(e.id))
          .map(([id]) => `im Paket ${packageName(id)} enthalten`),
      ].filter(Boolean);
      return `  ${pad(e.id, 14)}${pad(e.name, 36)}${pad(formatEuro(e.price), 10)}${flags.join(", ")}`;
    }),
    "",
    `Abholung: ${tiers.join(", ")}, darüber auf Anfrage; im Paket ${packageName(pickup.freeWithPackageId)} bis ${pickup.freeUpToKm} km enthalten.`,
    `Orte: ${data.cities.map((c) => `${c.name} (${c.km} km)`).join(", ")}`,
  ];
  return lines.join("\n") + "\n";
}

function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      paket: { type: "string" },
      klasse: { type: "string" },
      extras: { type: "string" },
      ort: { type: "string" },
      km: { type: "string" },
      json: { type: "boolean" },
      liste: { type: "boolean" },
      hilfe: { type: "boolean", short: "h" },
    },
  });
  if (values.hilfe) {
    process.stdout.write(USAGE);
    return;
  }
  const data = loadData();
  if (values.liste) {
    process.stdout.write(formatListe(data));
    return;
  }
  const result = berechne(data, {
    paket: values.paket,
    klasse: values.klasse,
    extras: (values.extras ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ort: values.ort,
    km: values.km,
  });
  process.stdout.write(
    values.json ? JSON.stringify(result, null, 2) + "\n" : formatMarkdown(result, data),
  );
}

function invokedDirectly() {
  try {
    return (
      Boolean(process.argv[1]) &&
      realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof InputError) && !String(error?.code).startsWith("ERR_PARSE_ARGS")) {
      throw error;
    }
    process.stderr.write(`${error.message}\n\n${USAGE}`);
    process.exitCode = 2;
  }
}
