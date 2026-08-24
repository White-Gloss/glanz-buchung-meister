const PUBLIC_PAGE_PREFIXES = [
  "/abholservice",
  "/leistungen",
  "/preise",
  "/qualitaet",
  "/impressum",
  "/datenschutz",
  "/faq",
  "/ratgeber",
  "/agb",
  "/widerruf",
  "/fahrzeug-zustand",
];

// Beide Dankeseiten führen Name und Vorgangsnummer in der Adresse und zeigen
// den Namen an. "/danke" deckt "/danke-dellen" nicht mit ab: der Abgleich
// verlangt den vollständigen Abschnitt, sonst geriete auch "/dankeschoen"
// hinein.
const PRIVATE_PAGE_PREFIXES = ["/admin", "/auth", "/reset-password", "/danke", "/danke-dellen"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function cacheControlForPath(pathname: string): string | null {
  if (PRIVATE_PAGE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return "private, no-store";
  }

  if (
    pathname === "/" ||
    pathname === "/robots.txt" ||
    PUBLIC_PAGE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
  ) {
    return "no-cache, must-revalidate";
  }

  // XML-Sitemap behält die von der Route gesetzte öffentliche Frischefrist.
  if (pathname === "/sitemap.xml") return null;

  // Unbekannte, private und technische Pfade behalten ihre eigenen Header.
  return null;
}
