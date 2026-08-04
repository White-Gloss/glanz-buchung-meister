/**
 * MATRIX-SEITEN: DIENSTLEISTUNG × STADT (Local-SEO-Matrix)
 * --------------------------------------------------------
 * Erzeugt aus den vorhandenen Datenquellen `servicePages` (7 Leistungen) und
 * `pickupCities` (13 Städte) alle Kombinationsseiten unter
 * `/leistungen/[dienst]/[stadt]`.
 *
 * ANTI-DUPLICATE-CONTENT
 * Identischer Text mit ausgetauschtem Stadtnamen wird von Google als doppelter
 * Inhalt gewertet. Deshalb wird jede Seite aus mehreren echten Datenpunkten
 * zusammengesetzt, die sich zwischen den Kombinationen unterscheiden:
 *
 *   1. Leistungsdaten   – Text, Ablauf und FAQ der jeweiligen Dienstleistung
 *   2. Stadtdaten       – Entfernung, Fahrzeit, Anfahrtsweg, Stadtteile,
 *                         Landkreis, lokale Bedarfslage
 *   3. Entfernungsband  – je Leistung ein eigener Absatz für Heimatstandort,
 *                         Nahbereich, mittlere und große Entfernung
 *   4. Musterrotation   – H1-, Überschriften- und Meta-Muster rotieren über
 *                         eine aus Leistung UND Stadt gebildete Kennzahl
 *
 * WICHTIG: Programmatisch kombinierter Text senkt das Risiko, ersetzt aber
 * keine echten lokalen Belege. Referenzfahrzeuge, Fotos vor Ort oder konkrete
 * Kundenprojekte pro Stadt sind das stärkste Signal – diese Angaben müssen aus
 * dem Betrieb kommen und dürfen nicht erfunden werden.
 */

import { absUrl, SITE_URL } from "./seo";
import { homeBase, pickupCities, type PickupCity } from "./pickupLocations";
import { servicePages, type ServicePage } from "./servicePages";
import {
  company,
  getPickupPrice,
  isPickupIncluded,
  pickupPricing,
  pickupPriceText,
  pickupTierSummary,
} from "./servicesConfig";

/* ------------------------------------------------------------------ */
/* Grundlagen                                                          */
/* ------------------------------------------------------------------ */

export type ServiceCityCombo = { service: ServicePage; city: PickupCity };

/** Entfernungsband – Grundlage für leistungsspezifische Absätze. */
export type DistanceBand = "home" | "near" | "mid" | "far";

export function distanceBand(distanceKm: number): DistanceBand {
  if (distanceKm === 0) return "home";
  if (distanceKm <= 20) return "near";
  if (distanceKm <= 40) return "mid";
  return "far";
}

/** Stabile Kennzahl je Kombination – sorgt für rotierende Textmuster. */
function comboSeed(service: ServicePage, city: PickupCity): number {
  const s = servicePages.findIndex((item) => item.slug === service.slug);
  const c = pickupCities.findIndex((item) => item.slug === city.slug);
  // Ungleiche Faktoren, damit benachbarte Städte derselben Leistung
  // nicht dasselbe Muster erhalten.
  return Math.abs(s * 5 + c * 3);
}

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function getServiceCityCombo(
  serviceSlug: string,
  citySlug: string,
): ServiceCityCombo | undefined {
  const service = servicePages.find((item) => item.slug === serviceSlug);
  const city = pickupCities.find((item) => item.slug === citySlug);
  if (!service || !city) return undefined;
  return { service, city };
}

/** Alle Kombinationen – für Sitemap, Übersichtsraster und Tests. */
export function allServiceCityCombos(): ServiceCityCombo[] {
  return servicePages.flatMap((service) => pickupCities.map((city) => ({ service, city })));
}

export function serviceCityPath(serviceSlug: string, citySlug: string): string {
  return `/leistungen/${serviceSlug}/${citySlug}`;
}

/* ------------------------------------------------------------------ */
/* Leistungsspezifische Absätze je Entfernungsband                     */
/* ------------------------------------------------------------------ */

type BandTexts = Record<DistanceBand, string>;

/**
 * Pro Leistung ein eigener Absatz je Entfernungsband. Ergibt 7 × 4 = 28
 * unterschiedliche Kernaussagen, die zusätzlich mit Stadtdaten kombiniert
 * werden.
 */
const serviceBandText: Record<string, BandTexts> = {
  innenraumreinigung: {
    home: "Weil Ihr Fahrzeug aus dem Stadtgebiet kommt, lässt sich die Trocknungszeit nach der Textilreinigung flexibel einplanen – bei Bedarf bleibt das Fahrzeug einfach über Nacht in der Halle.",
    near: "Die kurze Distanz hilft bei der Innenreinigung besonders: Textilien brauchen nach der Tiefenreinigung Zeit zum Durchtrocknen, und wir können die Rückgabe passend danach legen statt sie zu erzwingen.",
    mid: "Bei dieser Entfernung planen wir Abholung und Rückgabe so, dass zwischen Textilreinigung und Rückfahrt genügend Trocknungszeit liegt. Ein feuchter Innenraum geht bei uns nicht auf die Fahrt.",
    far: "Über die größere Distanz koordinieren wir Abholung und Rückgabe an festen Terminfenstern. Die Trocknung der Textilien ist dabei fest eingeplant – das Fahrzeug verlässt die Halle erst durchgetrocknet.",
  },
  lackkorrektur: {
    home: "Für Fahrzeuge aus dem Stadtgebiet ist eine Zwischenbegutachtung unkompliziert: Sie können den Lack nach der ersten Politurstufe selbst bei kontrolliertem Licht ansehen, bevor wir weiterarbeiten.",
    near: "Die kurze Anfahrt macht eine Zwischenabstimmung leicht. Gerade bei der Lackkorrektur lohnt sich das, weil sich erst nach der ersten Stufe zeigt, wie tief die Kratzer wirklich sitzen.",
    mid: "Vor Beginn stimmen wir ab, wie weit die Korrektur gehen soll. Das ist bei dieser Entfernung wichtiger als vor Ort, weil Zwischenfragen nicht mit einer kurzen Vorbeifahrt geklärt werden können.",
    far: "Bei größerer Entfernung dokumentieren wir den Lackzustand vor der Bearbeitung und stimmen den Korrekturumfang vorab ab. So gibt es keine offenen Fragen, während das Fahrzeug bei uns steht.",
  },
  keramikversiegelung: {
    home: "Die Keramikversiegelung braucht eine staubarme Umgebung und feste Aushärtezeit. Beides steht in unserer Halle bereit – Ihr Fahrzeug bleibt dafür die gesamte Bearbeitungszeit vor Ort.",
    near: "Weil die Versiegelung mehrere Tage Aushärtezeit benötigt, planen wir den Termin fest ein. Die kurze Entfernung erleichtert die Abstimmung von Abholung und Rückgabe erheblich.",
    mid: "Eine Keramikversiegelung ist kein Termin für zwischendurch: Lackkorrektur, Auftrag und Aushärtung brauchen zusammen mehrere Tage. Wir stimmen den Zeitraum vorab verbindlich ab.",
    far: "Trotz der größeren Entfernung bleibt der Ablauf planbar: Wir vereinbaren Abhol- und Rückgabetermin im Voraus und rechnen die Aushärtezeit der Versiegelung fest mit ein.",
  },
  lederpflege: {
    home: "Lederflächen reagieren unterschiedlich auf Reinigung – je nach Ausstattung und Alter. Aus dem Stadtgebiet lässt sich eine kurze gemeinsame Sichtung vor Beginn problemlos einrichten.",
    near: "Vor der Behandlung prüfen wir, wie das Leder in Ihrem Fahrzeug ausgeführt ist. Bei kurzer Anfahrt können wir Rückfragen dazu direkt vor der Abholung klären.",
    mid: "Damit die Behandlung zum Material passt, klären wir Ausstattung und Zustand des Leders vor der Abholung ab. Das erspart bei dieser Entfernung unnötige Zwischenschritte.",
    far: "Bei größerer Distanz besprechen wir Materialart und Zustand der Lederflächen bereits im Vorfeld, damit die Behandlung feststeht, sobald das Fahrzeug in der Halle ist.",
  },
  fahrzeugaufbereitung: {
    home: "Aus dem Stadtgebiet lässt sich der Umfang der Aufbereitung unkompliziert gemeinsam festlegen – Sie können das Fahrzeug bei der Übergabe direkt mit uns durchgehen.",
    near: "Der Umfang einer Komplettaufbereitung hängt vom Zustand ab. Die kurze Entfernung macht es leicht, offene Punkte vor dem Start kurz abzustimmen.",
    mid: "Vor der Abholung klären wir, welcher Umfang sinnvoll ist. So steht bei dieser Entfernung von Anfang an fest, was am Fahrzeug passiert und wie lange es dauert.",
    far: "Über die größere Distanz legen wir den Aufbereitungsumfang vorab fest und halten die Bearbeitungszeit in einem Zug – das Fahrzeug pendelt nicht zweimal.",
  },
  "smart-repair": {
    home: "Ob eine Delle für Smart Repair geeignet ist, zeigt sich erst am Fahrzeug. Aus dem Stadtgebiet ist eine kurze Begutachtung vorab unkompliziert möglich.",
    near: "Vor jeder Zusage steht die Begutachtung. Bei kurzer Anfahrt lässt sich das gut vorab erledigen, sodass Sie vor der eigentlichen Bearbeitung wissen, was möglich ist.",
    mid: "Damit die Fahrt sich lohnt, klären wir die Machbarkeit möglichst früh – gern anhand von Fotos der betroffenen Stelle, bevor ein Termin fest vereinbart wird.",
    far: "Bei dieser Entfernung empfiehlt sich eine Vorabklärung anhand von Fotos. So vermeiden wir, dass ein Fahrzeug anreist, bei dem das Verfahren an seine Grenzen stößt.",
  },
  leasingrueckgabe: {
    home: "Vor einer Rückgabe zählt der Termin: Aus dem Stadtgebiet lässt sich die Aufbereitung auch kurzfristig noch vor dem Rückgabedatum einplanen.",
    near: "Planen Sie die Aufbereitung einige Tage vor dem Rückgabetermin ein. Die kurze Entfernung schafft Puffer, falls sich bei der Sichtung zusätzlicher Bedarf zeigt.",
    mid: "Weil Abholung und Rückgabe bei dieser Entfernung Fahrzeit binden, sollte der Termin mit Abstand vor dem Rückgabedatum liegen – wir planen ihn entsprechend.",
    far: "Bei größerer Distanz ist der zeitliche Vorlauf entscheidend. Wir legen den Termin so, dass zwischen Rückgabe des aufbereiteten Fahrzeugs und Ihrem Leasingtermin Luft bleibt.",
  },
};

function bandTextFor(service: ServicePage, city: PickupCity): string {
  const texts = serviceBandText[service.slug];
  const band = distanceBand(city.distanceKm);
  return texts ? texts[band] : "";
}

/* ------------------------------------------------------------------ */
/* Meta-Daten-Generator                                                */
/* ------------------------------------------------------------------ */

export type ServiceCityMeta = {
  title: string;
  description: string;
  canonical: string;
  h1: string;
};

/**
 * Title (max. 60 Zeichen) und Description (max. 155 Zeichen) je Kombination.
 * Beide enthalten Leistung UND Stadt und sind dadurch bereits paarweise
 * eindeutig; die rotierenden Muster verhindern zusätzlich, dass alle Seiten
 * strukturell gleich aussehen.
 */
export function buildServiceCityMeta(service: ServicePage, city: PickupCity): ServiceCityMeta {
  const seed = comboSeed(service, city);
  const s = service.shortName;
  const c = city.short;
  const isHome = city.distanceKm === 0;

  const titlePatterns = [
    `${s} ${c} | ${company.name}`,
    `${s} in ${c} – mit Abholservice`,
    `${s} ${c}: Abholung & Rückgabe`,
    `${s} für ${c} | Werkstatt Horb`,
    `${s} ${c} – Termin online anfragen`,
  ];

  const title = isHome
    ? `${s} ${c} am Neckar | ${company.name}`
    : titlePatterns[seed % titlePatterns.length];

  // Leistungen, deren Paket die Abholung ohnehin enthält, dürfen in der
  // Description keinen Preis versprechen, der so nie anfällt.
  const priceText = pickupIncludedForService(service, city)
    ? "im Paket inklusive"
    : pickupPriceText(city.distanceKm);
  const descriptionPatterns = [
    `${service.shortName} für Fahrzeuge aus ${city.name}: Abholung ${priceText}, ${city.distanceKm} km bis zur Werkstatt in ${homeBase.city}. Jetzt Termin anfragen.`,
    `${service.shortName} in ${city.name} (${city.district}): Wir holen Ihr Fahrzeug ab, arbeiten in ${homeBase.city} und bringen es zurück – Abholung ${priceText}.`,
    `${city.short}: ${service.shortName} ohne eigene Anfahrt. Rund ${city.driveMinutes} Minuten bis zu unserer Werkstatt, Abholung ${priceText}.`,
    `${service.shortName} für ${city.name} – Ausführung in ${homeBase.city}, Anfahrt ${city.route}. Abholung ${priceText}.`,
  ];

  const description = isHome
    ? `${service.shortName} direkt in ${city.name}: Ausführung in unserer Werkstatt vor Ort, Hol- und Bringservice im Stadtgebiet kostenlos. Jetzt Termin anfragen.`
    : descriptionPatterns[seed % descriptionPatterns.length];

  const h1Patterns = [
    `${service.name} für Kunden aus ${city.name} – inkl. Abholservice`,
    `${service.name} ${city.name}: Abholung, Ausführung in ${homeBase.city}, Rückgabe`,
    `Profi-${service.shortName} für ${city.name} mit Hol- und Bringservice`,
    `${service.name} in ${city.name} – ohne eigene Anfahrt`,
  ];

  const h1 = isHome
    ? `${service.name} in ${city.name} – direkt in unserer Werkstatt`
    : h1Patterns[seed % h1Patterns.length];

  return {
    title: clamp(title, 60),
    description: clamp(description, 155),
    canonical: absUrl(serviceCityPath(service.slug, city.slug)),
    h1,
  };
}

/* ------------------------------------------------------------------ */
/* Inhaltsbausteine                                                    */
/* ------------------------------------------------------------------ */

export type ContentSection = { heading: string; paragraphs: string[] };

/**
 * true, wenn die Abholung bei dieser Leistung über das zugehörige Paket
 * ohnehin kostenfrei ist (aktuell: High-End Keramik bis 60 km).
 */
export function pickupIncludedForService(service: ServicePage, city: PickupCity): boolean {
  if (!service.relatedPackageIds.includes(pickupPricing.freeWithPackageId)) return false;
  // Nur wenn das Paket die einzige sinnvolle Zuordnung ist, gilt die Aussage
  // uneingeschränkt – sonst bleibt es beim Staffelpreis.
  if (service.relatedPackageIds.length > 1) return false;
  return isPickupIncluded(pickupPricing.freeWithPackageId, city.distanceKm);
}

/** Preisaussage zur Abholung für genau diese Kombination. */
export function pickupStatement(service: ServicePage, city: PickupCity): string {
  const included = pickupIncludedForService(service, city);
  const price = getPickupPrice(city.distanceKm);

  if (city.distanceKm === 0) {
    return `Für ${city.name} ist der Hol- und Bringservice kostenlos – wir sind hier vor Ort.`;
  }
  if (price === null) {
    return `${city.name} liegt mit ${city.distanceKm} km außerhalb unserer festen Preisstaffel. Die Abholung kalkulieren wir hier individuell auf Anfrage.`;
  }
  if (included) {
    return `Für diese Leistung ist der Hol- und Bringservice nach ${city.name} im Paket High-End Keramik enthalten (bis ${pickupPricing.freeUpToKm} km). Ohne dieses Paket gilt die Staffel: bei ${city.distanceKm} km ${pickupPriceText(city.distanceKm)}.`;
  }

  return price === 0
    ? `Bei ${city.distanceKm} km Entfernung ist die Abholung aus ${city.name} kostenlos.`
    : `Bei ${city.distanceKm} km Entfernung kostet die Abholung aus ${city.name} ${pickupPriceText(city.distanceKm)}.`;
}

/**
 * Baut die Textabschnitte der Kombinationsseite. Reihenfolge und Überschriften
 * rotieren, die Inhalte stammen aus Leistungs- und Stadtdaten.
 */
export function buildServiceCitySections(service: ServicePage, city: PickupCity): ContentSection[] {
  const seed = comboSeed(service, city);
  const isHome = city.distanceKm === 0;

  const anfahrtHeadings = [
    `Anfahrt und Abholung: ${city.name} → ${homeBase.city}`,
    `So kommt Ihr Fahrzeug von ${city.short} zu uns`,
    `Wege und Zeiten zwischen ${city.short} und ${homeBase.city}`,
  ];

  const leistungHeadings = [
    `${service.name} – so arbeiten wir`,
    `Was bei der ${service.shortName} passiert`,
    `${service.shortName} im Detail`,
  ];

  const regionHeadings = [
    `Warum ${service.shortName} in ${city.short} nachgefragt wird`,
    `${city.name}: typische Ausgangslage`,
    `Was Fahrzeuge aus ${city.short} mitbringen`,
  ];

  const anfahrt: ContentSection = {
    heading: anfahrtHeadings[seed % anfahrtHeadings.length],
    paragraphs: isHome
      ? [
          `${city.intro}`,
          `Bearbeitet wird ausschließlich in unserer Werkstatt in ${homeBase.city} – bei ${city.name} ist das der Standort selbst. ${pickupStatement(service, city)}`,
        ]
      : [
          `Zwischen ${city.name} und unserer Werkstatt in ${homeBase.city} liegen rund ${city.distanceKm} km, die Fahrzeit beträgt etwa ${city.driveMinutes} Minuten ${city.route}. Wir übernehmen diese Strecke in beide Richtungen.`,
          `Abgedeckt sind auch die umliegenden Orte und Stadtteile: ${city.districts.join(", ")}. ${pickupStatement(service, city)}`,
          `Wichtig für die Einordnung: In ${city.name} finden ausschließlich Abholung und Rückgabe statt. Die ${service.shortName} selbst führen wir in ${homeBase.city} aus, wo Polierkabine, kontrollierte Beleuchtung und ein staubarmer Arbeitsbereich zur Verfügung stehen.`,
        ],
  };

  const leistung: ContentSection = {
    heading: leistungHeadings[seed % leistungHeadings.length],
    paragraphs: [service.lead, service.detail, bandTextFor(service, city)].filter(Boolean),
  };

  const region: ContentSection = {
    heading: regionHeadings[seed % regionHeadings.length],
    paragraphs: [city.demand, city.localBenefit].filter(Boolean),
  };

  // Reihenfolge rotieren: mal führt die Leistung, mal die Region.
  return seed % 2 === 0 ? [leistung, anfahrt, region] : [anfahrt, leistung, region];
}

/** FAQ der Kombination: Leistungsfragen plus stadtbezogene Fragen. */
export function buildServiceCityFaq(service: ServicePage, city: PickupCity): [string, string][] {
  const seed = comboSeed(service, city);
  const serviceFaq = service.faq.filter(
    ([question]) => !question.toLowerCase().includes("abgeholt"),
  );
  const rotated = [...serviceFaq.slice(seed % serviceFaq.length), ...serviceFaq].slice(0, 2);

  return [
    [
      `Was kostet die Abholung für ${service.shortName} in ${city.name}?`,
      `${pickupStatement(service, city)} Die Staffel gilt einheitlich: ${pickupTierSummary()}. Der Preis ist unabhängig von der Fahrzeugklasse.`,
    ],
    [
      `Wo wird mein Fahrzeug bearbeitet?`,
      city.distanceKm === 0
        ? `In unserer Werkstatt in ${homeBase.city}. Da Sie ebenfalls in ${city.name} sind, ist der Weg denkbar kurz.`
        : `Ausschließlich in unserer Werkstatt in ${homeBase.city}. In ${city.name} finden nur Abholung und Rückgabe statt – die Fahrzeit beträgt rund ${city.driveMinutes} Minuten pro Strecke.`,
    ],
    ...rotated,
  ];
}

/* ------------------------------------------------------------------ */
/* JSON-LD: AutoRepair + Service + Breadcrumb + FAQ                    */
/* ------------------------------------------------------------------ */

export function buildServiceCityJsonLd(service: ServicePage, city: PickupCity) {
  const meta = buildServiceCityMeta(service, city);
  const businessId = `${meta.canonical}#business`;

  const autoRepair = {
    "@type": "AutoRepair",
    "@id": businessId,
    name: `${company.name} – ${service.shortName} mit Abholservice ${city.name}`,
    description: meta.description,
    url: meta.canonical,
    email: company.email,
    priceRange: "€€–€€€",
    // Physischer Standort bleibt immer Horb am Neckar.
    address: {
      "@type": "PostalAddress",
      streetAddress: company.street || undefined,
      addressLocality: "Horb am Neckar-Dettingen",
      postalCode: homeBase.postalCode,
      addressRegion: homeBase.state,
      addressCountry: homeBase.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: homeBase.latitude,
      longitude: homeBase.longitude,
    },
    // Versorgungsgebiet ist die jeweilige Zielstadt.
    areaServed: {
      "@type": "City",
      name: city.name,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: city.district,
      },
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${service.name} für ${city.name}`,
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            "@id": `${meta.canonical}#service`,
          },
        },
      ],
    },
  };

  const serviceNode = {
    "@type": "Service",
    "@id": `${meta.canonical}#service`,
    name: `${service.name} ${city.name}`,
    serviceType: service.name,
    description: meta.description,
    url: meta.canonical,
    provider: { "@id": businessId },
    areaServed: { "@type": "City", name: city.name },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Startseite", item: absUrl("/") },
      { "@type": "ListItem", position: 2, name: "Leistungen", item: absUrl("/leistungen") },
      {
        "@type": "ListItem",
        position: 3,
        name: service.name,
        item: absUrl(`/leistungen/${service.slug}`),
      },
      { "@type": "ListItem", position: 4, name: city.name, item: meta.canonical },
    ],
  };

  const faq = {
    "@type": "FAQPage",
    mainEntity: buildServiceCityFaq(service, city).map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [autoRepair, serviceNode, breadcrumb, faq],
  };
}

/** Nachbarstädte derselben Leistung – für die interne Verlinkung. */
export function siblingCities(service: ServicePage, city: PickupCity, count = 6): PickupCity[] {
  const others = pickupCities.filter((item) => item.slug !== city.slug);
  const sorted = [...others].sort(
    (a, b) => Math.abs(a.distanceKm - city.distanceKm) - Math.abs(b.distanceKm - city.distanceKm),
  );
  return sorted.slice(0, count);
}

/** Weitere Leistungen für dieselbe Stadt – für die interne Verlinkung. */
export function siblingServices(service: ServicePage, count = 6): ServicePage[] {
  return servicePages.filter((item) => item.slug !== service.slug).slice(0, count);
}

export { SITE_URL };
