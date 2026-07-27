/**
 * REGIONALE ABHOLSERVICE-STANDORTE (Local SEO)
 * --------------------------------------------
 * Zentrale Datenquelle für alle Städte-Landingpages unter /abholservice/[slug].
 * Hier können Städte ergänzt, Entfernungen oder Texte angepasst werden –
 * Seiten, Meta-Daten, JSON-LD, Übersicht und Sitemap ziehen automatisch nach.
 */

import { company } from "./servicesConfig";

export type PickupCity = {
  /** URL-Slug: /abholservice/{slug} */
  slug: string;
  /** Vollständiger Ortsname */
  name: string;
  /** Kurzform für Fließtext & Buttons */
  short: string;
  /** Postleitzahl-Bereich (Rich Content, kein Duplicate Content) */
  postalCodes: string;
  /** Landkreis / Region */
  district: string;
  /** Entfernung zur Werkstatt in km */
  distanceKm: number;
  /** Ungefähre Fahrzeit in Minuten */
  driveMinutes: number;
  /** Hauptverbindung / Anfahrtsweg */
  route: string;
  /** Stadtteile & umliegende Orte, die mit abgedeckt werden */
  districts: string[];
  /** Regionsspezifischer Einleitungsabsatz (individuell je Stadt) */
  intro: string;
  /** Lokaler Kundenvorteil / typisches Kundenprofil */
  localBenefit: string;
  /** Typische Fahrzeug- bzw. Bedarfssituation vor Ort */
  demand: string;
  /** Fokus-Keyword für Title & H1 */
  focusKeyword: string;
  /** Individueller FAQ-Zusatz */
  faqExtra: string;
};

/** Hauptstandort der Werkstatt */
export const homeBase = {
  city: "Horb am Neckar",
  region: "Landkreis Freudenstadt",
  state: "Baden-Württemberg",
  postalCode: "72160",
  country: "DE",
  latitude: 48.4442,
  longitude: 8.6903,
};

export const pickupCities: PickupCity[] = [
  {
    slug: "horb-am-neckar",
    name: "Horb am Neckar",
    short: "Horb",
    postalCodes: "72160",
    district: "Landkreis Freudenstadt",
    distanceKm: 0,
    driveMinutes: 10,
    route: "direkt vor Ort – unsere Werkstatt liegt in Horb am Neckar",
    districts: ["Hohenberg", "Altheim", "Nordstetten", "Dettingen", "Mühlen", "Bildechingen"],
    intro:
      "Horb am Neckar ist unser Heimatstandort. Hier steht unsere Aufbereitungshalle mit Polierkabine, kontrollierter Beleuchtung und staubarmem Versiegelungsbereich. Fahrzeuge aus dem Stadtgebiet und den Teilorten holen wir in der Regel noch am selben oder am darauffolgenden Werktag ab.",
    localBenefit:
      "Als lokale Kundschaft profitieren Sie von kurzfristigen Terminen, Hol- und Bringservice ohne Aufpreis und der Möglichkeit, das Ergebnis bei Tageslicht direkt in der Halle abzunehmen.",
    demand:
      "Zwischen Neckartal-Pendelverkehr, Streusalz im Winter und Baumharz in den Hanglagen setzt das Klima rund um Horb dem Lack spürbar zu – Lackkorrektur und Keramikversiegelung sind hier besonders gefragt.",
    focusKeyword: "Fahrzeugaufbereitung Horb am Neckar",
    faqExtra:
      "In Horb selbst ist auch eine spontane Vorbeifahrt zur kostenlosen Lackbegutachtung möglich.",
  },
  {
    slug: "nagold",
    name: "Nagold",
    short: "Nagold",
    postalCodes: "72202",
    district: "Landkreis Calw",
    distanceKm: 20,
    driveMinutes: 22,
    route: "über die B28a und B463 durchs Nagoldtal",
    districts: ["Emmingen", "Hochdorf", "Iselshausen", "Pfrondorf", "Vollmaringen"],
    intro:
      "Nagold verbindet historische Altstadt mit einem starken Mittelstand – und mit vielen gepflegten Firmen- und Privatfahrzeugen. Unser Abholservice übernimmt Ihr Auto direkt an der Wohn- oder Firmenadresse im Nagolder Stadtgebiet.",
    localBenefit:
      "Für Gewerbekunden im Wolfsberg- und Emminger Gewerbegebiet organisieren wir Sammelabholungen mehrerer Fahrzeuge an einem Termin – das spart Ausfallzeit im Fuhrpark.",
    demand:
      "Viele Nagolder Fahrzeuge stehen dauerhaft im Freien unter Baumbestand. Entsprechend häufig sind eingebrannte Harz- und Vogelkotflecken, die eine mehrstufige Lackkorrektur erfordern.",
    focusKeyword: "Fahrzeugaufbereitung Nagold",
    faqExtra:
      "Abholungen in Nagold führen wir bevorzugt morgens durch, damit Ihr Fahrzeug am selben Tag in die Bearbeitung geht.",
  },
  {
    slug: "rottenburg-am-neckar",
    name: "Rottenburg am Neckar",
    short: "Rottenburg",
    postalCodes: "72108",
    district: "Landkreis Tübingen",
    distanceKm: 25,
    driveMinutes: 25,
    route: "über die B28 entlang des Neckars",
    districts: ["Ergenzingen", "Baisingen", "Wendelsheim", "Hailfingen", "Kiebingen"],
    intro:
      "Rottenburg am Neckar liegt für uns auf der direkten Neckarachse. Ihr Fahrzeug wird zum vereinbarten Zeitpunkt abgeholt, in Horb aufbereitet und gereinigt sowie versiegelt zurückgebracht – Sie bleiben währenddessen mobil planbar.",
    localBenefit:
      "Rottenburger Kundinnen und Kunden nutzen häufig unsere Kombination aus Innenraum-Tiefenreinigung und Lederpflege – ideal für Familienfahrzeuge mit hoher Alltagsbelastung.",
    demand:
      "Der Pendelverkehr Richtung Tübingen und Stuttgart bedeutet hohe Kilometerleistung: Steinschlagnahe Frontpartien und Bremsstaub an den Felgen sind die typischen Themen vor Ort.",
    focusKeyword: "Fahrzeugaufbereitung Rottenburg am Neckar",
    faqExtra:
      "Auch die Rottenburger Teilorte entlang der B28 fahren wir ohne zusätzliche Anfahrtspauschale an.",
  },
  {
    slug: "freudenstadt",
    name: "Freudenstadt",
    short: "Freudenstadt",
    postalCodes: "72250",
    district: "Landkreis Freudenstadt",
    distanceKm: 30,
    driveMinutes: 30,
    route: "über die B28 hinauf in den Schwarzwald",
    districts: ["Kniebis", "Igelsberg", "Dietersweiler", "Wittlensweiler", "Grüntal"],
    intro:
      "Freudenstadt liegt mit uns im selben Landkreis – der Abholservice in die Höhenlagen des Schwarzwalds gehört zu unseren Standardrouten. Wir kalkulieren Winterwetter und Bergstrecken fest in die Terminplanung ein.",
    localBenefit:
      "Für Fahrzeuge aus den Höhenlagen empfehlen wir eine Keramikversiegelung mit Unterboden- und Felgenschutz: Streusalz und Feuchtigkeit greifen hier deutlich stärker an als im Tal.",
    demand:
      "Lange Winter, Salzeinsatz und Nadelharz sorgen in Freudenstadt für stumpfe Lackflächen und Flugrost – klassische Fälle für unsere zweistufige Politur.",
    focusKeyword: "Fahrzeugaufbereitung Freudenstadt",
    faqExtra:
      "Bei winterlichen Straßenverhältnissen holen wir ausschließlich mit wintertauglichem Transportfahrzeug ab.",
  },
  {
    slug: "herrenberg",
    name: "Herrenberg",
    short: "Herrenberg",
    postalCodes: "71083",
    district: "Landkreis Böblingen",
    distanceKm: 35,
    driveMinutes: 30,
    route: "über die A81, Anschlussstelle Herrenberg",
    districts: ["Gültstein", "Kuppingen", "Affstätt", "Haslach", "Mönchberg"],
    intro:
      "Herrenberg erreichen wir über die A81 in rund einer halben Stunde. Das macht die Stadt zu einem der am häufigsten angefahrenen Ziele unseres Abholservice – inklusive fester Wochentermine für Stammkunden.",
    localBenefit:
      "Berufspendler schätzen unsere Abholung vor Arbeitsbeginn: Wir übernehmen das Fahrzeug morgens und stellen es am Abend des Fertigstellungstages wieder bereit.",
    demand:
      "Autobahnnahe Nutzung bedeutet Insektenreste, Teerflecken und Bremsstaub – Lackknete, Eisenentferner und eine haltbare Versiegelung sind in Herrenberg besonders wirkungsvoll.",
    focusKeyword: "Fahrzeugaufbereitung Herrenberg",
    faqExtra:
      "Für Herrenberg bieten wir auf Wunsch feste Turnusintervalle (z. B. halbjährliche Auffrischung) an.",
  },
  {
    slug: "oberndorf-am-neckar",
    name: "Oberndorf am Neckar",
    short: "Oberndorf",
    postalCodes: "78727",
    district: "Landkreis Rottweil",
    distanceKm: 30,
    driveMinutes: 28,
    route: "über die B14 und das Neckartal südwärts",
    districts: ["Lindenhof", "Aistaig", "Beffendorf", "Boll", "Bochingen"],
    intro:
      "Oberndorf am Neckar liegt südlich von uns im Neckartal. Die Abholung erfolgt nach Terminabsprache direkt an Ihrer Adresse – ohne dass Sie einen halben Arbeitstag für Hin- und Rückfahrt einplanen müssen.",
    localBenefit:
      "Für Schichtarbeitende in der Oberndorfer Industrie bieten wir Abhol- und Rückgabezeiten außerhalb klassischer Bürozeiten an.",
    demand:
      "Enge Talstraßen und Werksparkplätze hinterlassen Spuren: Kratzer an Türkanten und Parkrempler-Spuren lassen sich oft mit einer gezielten Spot-Politur beheben.",
    focusKeyword: "Fahrzeugaufbereitung Oberndorf am Neckar",
    faqExtra:
      "Für Oberndorf koordinieren wir Abholungen gern gemeinsam mit Nachbarfahrzeugen in derselben Straße.",
  },
  {
    slug: "balingen",
    name: "Balingen",
    short: "Balingen",
    postalCodes: "72336",
    district: "Zollernalbkreis",
    distanceKm: 45,
    driveMinutes: 40,
    route: "über die B27 durch das Zollernalb-Vorland",
    districts: ["Frommern", "Endingen", "Weilstetten", "Engstlatt", "Ostdorf"],
    intro:
      "Balingen im Zollernalbkreis gehört zum erweiterten Einzugsgebiet unseres Abholservice. Für Fahrzeuge aus dieser Region planen wir feste Abholtage, um Anfahrt und Termin effizient zu bündeln.",
    localBenefit:
      "Ab Balingen lohnt sich besonders das Paket High-End Keramik: Ein Abholtermin, ein Rückgabetermin – und danach jahrelang deutlich weniger Reinigungsaufwand.",
    demand:
      "Die Albaufstiege und der Wetterwechsel am Albtrauf bedeuten viel Nässe, Split und Salz – Lackschutz ist hier kein Luxus, sondern Werterhalt.",
    focusKeyword: "Fahrzeugaufbereitung Balingen",
    faqExtra:
      "Abholungen in Balingen finden gebündelt an festen Wochentagen statt – fragen Sie den nächsten freien Termin an.",
  },
  {
    slug: "calw",
    name: "Calw",
    short: "Calw",
    postalCodes: "75365",
    district: "Landkreis Calw",
    distanceKm: 40,
    driveMinutes: 40,
    route: "über die B463 durch das Nagoldtal nordwärts",
    districts: ["Hirsau", "Stammheim", "Wimberg", "Heumaden", "Altburg"],
    intro:
      "Calw im nördlichen Schwarzwald erreichen wir über das Nagoldtal. Wir holen Ihr Fahrzeug in der Kernstadt sowie in den Stadtteilen ab und bringen es fertig aufbereitet wieder zurück.",
    localBenefit:
      "Für Fahrzeuge, die überwiegend in engen Altstadtgassen und Hanglagen bewegt werden, empfehlen wir unsere Kombination aus Lackkorrektur und Kantenschutz.",
    demand:
      "Feuchte Talluft und schattige Stellplätze fördern Grünbelag an Dichtungen und Fensterrahmen – ein Punkt, den wir bei Calwer Fahrzeugen gezielt mitbehandeln.",
    focusKeyword: "Fahrzeugaufbereitung Calw",
    faqExtra:
      "Enge Zufahrten sind kein Problem: Wir stimmen den Abholpunkt vorab telefonisch mit Ihnen ab.",
  },
  {
    slug: "tuebingen",
    name: "Tübingen",
    short: "Tübingen",
    postalCodes: "72070–72076",
    district: "Landkreis Tübingen",
    distanceKm: 35,
    driveMinutes: 35,
    route: "über die B28 entlang des Neckars ostwärts",
    districts: ["Derendingen", "Lustnau", "Weststadt", "Wanne", "Bühl", "Hirschau"],
    intro:
      "In Tübingen ist Parkraum knapp und Zeit noch knapper. Genau dafür ist unser Abholservice gemacht: Wir übernehmen Ihr Fahrzeug an der Wunschadresse, auch in den Innenstadtlagen mit Parkraumbewirtschaftung.",
    localBenefit:
      "Für Leasingrückläufer aus dem Tübinger Raum bieten wir eine gezielte Rückgabe-Aufbereitung an, die typische Bewertungsabzüge sichtbar reduziert.",
    demand:
      "Laternenparker und schmale Altstadtgassen sorgen für feine Kratzer und Kontaktspuren an Stoßfängern – hier arbeiten wir mit punktueller Politur statt Komplettabtrag.",
    focusKeyword: "Fahrzeugaufbereitung Tübingen",
    faqExtra:
      "In Bewohnerparkzonen benötigen wir für die Abholung lediglich Fahrzeugschlüssel und eine kurze Freigabe per Nachricht.",
  },
  {
    slug: "boeblingen",
    name: "Böblingen",
    short: "Böblingen",
    postalCodes: "71032–71034",
    district: "Landkreis Böblingen",
    distanceKm: 50,
    driveMinutes: 40,
    route: "über die A81 Richtung Stuttgart",
    districts: ["Dagersheim", "Diezenhalde", "Rauher Kapf", "Tannenberg"],
    intro:
      "Böblingen ist Automobilstandort – entsprechend hoch sind die Ansprüche an eine Aufbereitung. Wir holen Ihr Fahrzeug im Stadtgebiet ab und arbeiten in Horb unter kontrollierten Bedingungen mit Prüflampen und Schichtdickenmessung.",
    localBenefit:
      "Firmenwagen und Dienstfahrzeuge bereiten wir auf Wunsch mit dokumentiertem Vorher-/Nachher-Protokoll auf – hilfreich bei Leasingrückgabe und interner Fuhrparkabrechnung.",
    demand:
      "Hohe Laufleistungen, Tiefgaragenstaub und Autobahnanteile prägen den Fahrzeugbestand rund um Böblingen – Innenraumhygiene und Lackschutz sind hier gleichermaßen gefragt.",
    focusKeyword: "Fahrzeugaufbereitung Böblingen",
    faqExtra:
      "Für Fuhrparks ab drei Fahrzeugen erstellen wir ein individuelles Abhol- und Preisangebot.",
  },
  {
    slug: "sindelfingen",
    name: "Sindelfingen",
    short: "Sindelfingen",
    postalCodes: "71063–71067",
    district: "Landkreis Böblingen",
    distanceKm: 52,
    driveMinutes: 42,
    route: "über die A81, Anschlussstelle Böblingen/Sindelfingen",
    districts: ["Maichingen", "Darmsheim", "Eichholz", "Goldberg", "Hinterweil"],
    intro:
      "Sindelfingen liegt direkt neben Böblingen und wird von uns auf derselben Route bedient. Abholung und Rückgabe lassen sich dadurch besonders flexibel takten – auch am selben Tag in beide Richtungen.",
    localBenefit:
      "Wer sein Fahrzeug privat verkaufen möchte, profitiert hier spürbar: Eine professionelle Aufbereitung vor dem Verkaufsinserat verbessert Fotos und Verhandlungsposition deutlich.",
    demand:
      "Viele Sindelfinger Fahrzeuge sind Neuwagen oder junge Gebrauchte – für sie ist eine frühe Keramikversiegelung die wirtschaftlichste Schutzmaßnahme.",
    focusKeyword: "Fahrzeugaufbereitung Sindelfingen",
    faqExtra:
      "Abholungen in Sindelfingen und Böblingen kombinieren wir häufig – dadurch bleiben kurzfristige Termine möglich.",
  },
  {
    slug: "rottweil",
    name: "Rottweil",
    short: "Rottweil",
    postalCodes: "78628",
    district: "Landkreis Rottweil",
    distanceKm: 45,
    driveMinutes: 35,
    route: "über die A81 südwärts, Anschlussstelle Rottweil",
    districts: ["Hausen", "Neukirch", "Göllsdorf", "Bühlingen", "Zimmern"],
    intro:
      "Rottweil erreichen wir über die A81 in gut einer halben Stunde. Die Abholung erfolgt zum vereinbarten Zeitfenster, die Rückgabe nach Abschluss aller Arbeitsschritte inklusive Endkontrolle unter Prüflicht.",
    localBenefit:
      "Für Oldtimer und Liebhaberfahrzeuge aus dem Raum Rottweil arbeiten wir besonders zurückhaltend: schonende Handwäsche, Politur nur nach Schichtdickenmessung.",
    demand:
      "Die Höhenlage über dem Neckartal bringt starke Temperaturwechsel und Kondensfeuchte mit sich – Innenraumhygiene und Geruchsneutralisation sind hier ein häufiges Thema.",
    focusKeyword: "Fahrzeugaufbereitung Rottweil",
    faqExtra:
      "Für Oldtimer erstellen wir vor Arbeitsbeginn eine fotografische Zustandsdokumentation.",
  },
  {
    slug: "reutlingen",
    name: "Reutlingen",
    short: "Reutlingen",
    postalCodes: "72760–72770",
    district: "Landkreis Reutlingen",
    distanceKm: 50,
    driveMinutes: 45,
    route: "über die B28 via Tübingen",
    districts: ["Betzingen", "Orschel-Hagen", "Sondelfingen", "Rommelsbach", "Gönningen"],
    intro:
      "Reutlingen markiert die östliche Grenze unseres Abholgebiets. Fahrzeuge aus dem Stadtgebiet holen wir nach Terminvereinbarung ab – meist gebündelt mit Abholungen aus Tübingen.",
    localBenefit:
      "Weil wir Reutlingen und Tübingen gemeinsam anfahren, bleibt der Service auch auf dieser Distanz planbar und ohne Aufschlag für Sie.",
    demand:
      "Stadtverkehr, Tiefgaragen und Albaufstiege beanspruchen Lack und Innenraum gleichermaßen – unser Premium-Paket deckt beides in einem Durchgang ab.",
    focusKeyword: "Fahrzeugaufbereitung Reutlingen",
    faqExtra:
      "Für Reutlingen empfehlen wir eine Anfrage mit einigen Tagen Vorlauf, damit wir die Route optimal planen können.",
  },
];

export function getPickupCity(slug: string): PickupCity | undefined {
  return pickupCities.find((c) => c.slug === slug);
}

/** Für die Ausgabe sortiert: nächstgelegene Städte zuerst */
export const pickupCitiesByDistance = [...pickupCities].sort(
  (a, b) => a.distanceKm - b.distanceKm,
);

/** Nachbarstädte für interne Verlinkung (verhindert isolierte Seiten) */
export function getNeighbourCities(slug: string, count = 4): PickupCity[] {
  const current = getPickupCity(slug);
  if (!current) return pickupCitiesByDistance.slice(0, count);
  return pickupCities
    .filter((c) => c.slug !== slug)
    .sort(
      (a, b) =>
        Math.abs(a.distanceKm - current.distanceKm) - Math.abs(b.distanceKm - current.distanceKm),
    )
    .slice(0, count);
}

/* -------------------------------------------------------------------------
 * SEO-META-GENERATOR
 * Titel: max. ~60 Zeichen · Description: max. ~155 Zeichen
 * ---------------------------------------------------------------------- */

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type SeoMeta = { title: string; description: string; canonical: string };

/**
 * Erzeugt Title & Description je Stadt. Um Duplicate-Content-Signale zu
 * vermeiden, rotieren Description-Muster anhand des Stadt-Index.
 */
export function buildCityMeta(city: PickupCity): SeoMeta {
  const isHome = city.distanceKm === 0;

  const titleCandidates = [
    `Fahrzeugaufbereitung ${city.short} | Abholservice`,
    `${city.short}: Fahrzeugaufbereitung mit Abholung`,
    `Autoaufbereitung ${city.short} – Hol- & Bringservice`,
  ];
  const idx = pickupCities.findIndex((c) => c.slug === city.slug);
  const title = isHome
    ? `Fahrzeugaufbereitung Horb am Neckar | ${company.name}`
    : titleCandidates[idx % titleCandidates.length];

  const descriptions = [
    `Professionelle Fahrzeugaufbereitung für ${city.name}: Wir holen Ihr Auto ab (${city.distanceKm} km, ca. ${city.driveMinutes} Min. nach Horb) und bringen es veredelt zurück.`,
    `Lackkorrektur, Keramikversiegelung & Innenreinigung für ${city.name}. Kostenloser Abholservice aus dem ${city.district} – Termin online anfragen.`,
    `Autoaufbereitung ${city.short} ohne Umweg: Abholung an Ihrer Adresse, Aufbereitung in unserer Werkstatt in Horb am Neckar, Rückgabe nach Wunschtermin.`,
  ];
  const description = isHome
    ? `Fahrzeugaufbereitung in Horb am Neckar: Lackkorrektur, Keramikversiegelung und Innenreinigung inklusive Hol- und Bringservice. Jetzt Termin anfragen.`
    : descriptions[idx % descriptions.length];


  return {
    title: clamp(title, 60),
    description: clamp(description, 155),
    canonical: `/abholservice/${city.slug}`,
  };
}

/* -------------------------------------------------------------------------
 * SCHEMA.ORG JSON-LD
 * ---------------------------------------------------------------------- */

export function buildCityJsonLd(city: PickupCity) {
  const meta = buildCityMeta(city);

  const autoRepair = {
    "@type": "AutoRepair",
    "@id": `${meta.canonical}#business`,
    name: `${company.name} – Fahrzeugaufbereitung mit Abholservice ${city.name}`,
    description: meta.description,
    telephone: company.phone,
    email: company.email,
    priceRange: "€€",
    // Physischer Standort: ausschließlich Horb am Neckar
    address: {
      "@type": "PostalAddress",
      streetAddress: company.street || undefined,
      addressLocality: homeBase.city,
      postalCode: homeBase.postalCode,
      addressRegion: homeBase.state,
      addressCountry: homeBase.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: homeBase.latitude,
      longitude: homeBase.longitude,
    },
    // Versorgungsgebiet: die jeweilige Zielstadt
    areaServed: {
      "@type": "City",
      name: city.name,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: city.district,
      },
    },
    serviceArea: {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: homeBase.latitude,
        longitude: homeBase.longitude,
      },
      geoRadius: 60000,
    },
    makesOffer: {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: `Fahrzeugaufbereitung mit Abholservice in ${city.name}`,
        serviceType: "Fahrzeugaufbereitung, Lackkorrektur, Keramikversiegelung",
        provider: { "@id": `${meta.canonical}#business` },
        areaServed: { "@type": "City", name: city.name },
      },
    },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Startseite", item: "/" },
      { "@type": "ListItem", position: 2, name: "Abholservice", item: "/abholservice" },
      { "@type": "ListItem", position: 3, name: city.name, item: meta.canonical },
    ],
  };

  const faq = {
    "@type": "FAQPage",
    mainEntity: buildCityFaqItems(city).map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };


  return {
    "@context": "https://schema.org",
    "@graph": [autoRepair, breadcrumb, faq],
  };
}

export function buildOverviewJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Abholservice-Gebiete für Fahrzeugaufbereitung",
    itemListElement: pickupCitiesByDistance.map((city, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `Fahrzeugaufbereitung ${city.name}`,
      url: `/abholservice/${city.slug}`,
    })),
  };
}
