import { cities, services } from "../data/site.ts";
import { articleNavigation } from "./article-navigation.ts";
import { citySeoCopy } from "./city-copy.ts";

export type SearchIntent = {
  cluster: string;
  intent: "local" | "commercial" | "informational" | "navigational";
  purpose: string;
};

/** One primary intent per indexable URL. This is editorial mapping, not a ranking claim. */
export const seoIntents: Record<string, SearchIntent> = {
  "/": {
    cluster: "fahrzeugaufbereitung horb",
    intent: "local",
    purpose: "Betrieb in Horb finden und Termin anfragen",
  },
  "/leistungen": {
    cluster: "autopflege leistungen übersicht",
    intent: "commercial",
    purpose: "Einzelleistungen vergleichen und auswählen",
  },
  "/preise": {
    cluster: "autoaufbereitung preise pakete",
    intent: "commercial",
    purpose: "Paketumfang, Einstiegspreise und Kalkulation vergleichen",
  },
  "/abholservice": {
    cluster: "autoaufbereitung hol und bringservice",
    intent: "commercial",
    purpose: "Abholgebiete und Entfernungsstaffeln vergleichen",
  },
  "/luxusfahrzeuge": {
    cluster: "luxusfahrzeug aufbereitung",
    intent: "commercial",
    purpose: "Pflege hochwertiger Fahrzeuge abklären",
  },
  "/qualitaet": {
    cluster: "white gloss arbeitsweise",
    intent: "navigational",
    purpose: "Arbeitsabläufe und Qualitätskontrolle prüfen",
  },
  "/faq": {
    cluster: "white gloss häufige fragen",
    intent: "navigational",
    purpose: "Übergreifende Fragen vor der Buchung beantworten",
  },
  "/kontakt": {
    cluster: "white gloss kontakt anfahrt",
    intent: "navigational",
    purpose: "Betrieb kontaktieren und Werkstatt erreichen",
  },
  "/galerie": {
    cluster: "white gloss aufbereitung ergebnisse",
    intent: "navigational",
    purpose: "Echte Arbeitsbeispiele ansehen",
  },
  "/dellen-hagelschaden": {
    cluster: "hagelschaden foto begutachtung",
    intent: "commercial",
    purpose: "Konkreten Schaden zur Prüfung einreichen",
  },
  "/fahrzeug-zustand": {
    cluster: "autoaufbereitung zustand einschätzung",
    intent: "commercial",
    purpose: "Individuelle Foto-Ersteinschätzung anfragen",
  },
  "/b2b": {
    cluster: "fahrzeugaufbereitung gewerbekunden horb",
    intent: "commercial",
    purpose: "Aufbereitung für Gewerbekunden abstimmen",
  },
  "/ratgeber": {
    cluster: "autopflege ratgeber",
    intent: "informational",
    purpose: "Antworten nach Pflegethema auswählen",
  },
  ...Object.fromEntries(
    services
      .filter((s) => !s.pendingApproval)
      .map((s) => [
        `/leistungen/${s.slug}`,
        {
          cluster:
            s.slug === "fahrzeugaufbereitung"
              ? "fahrzeugaufbereitung leistungsumfang"
              : `${s.seoNav.toLowerCase()} horb`,
          intent: "commercial" as const,
          purpose: `${s.nav}: Umfang, Grenzen und passende Anfrage`,
        },
      ]),
  ),
  ...Object.fromEntries(
    cities.map((c) => [
      `/abholservice/${c.slug}`,
      {
        cluster: citySeoCopy(c).cluster,
        intent: "local" as const,
        purpose: `Fahrzeugaufbereitung für ${c.name}: Leistungen, Preise, Abholung und Übergabe; Werkstatt ausschließlich Horb`,
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(articleNavigation).map(([slug, guide]) => [
      `/ratgeber/${slug}`,
      {
        cluster: guide.question.toLowerCase(),
        intent: "informational" as const,
        purpose: guide.question,
      },
    ]),
  ),
};
