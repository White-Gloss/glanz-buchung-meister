import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = new URL(process.env.SMOKE_BASE_URL || "https://white-gloss.de").origin;
const PUBLIC_ORIGIN = new URL(process.env.SMOKE_PUBLIC_ORIGIN || BASE_URL).origin;
const simulatePublicHost = PUBLIC_ORIGIN !== BASE_URL;
if (
  simulatePublicHost &&
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE_URL).hostname)
) {
  throw new Error("SMOKE_PUBLIC_ORIGIN darf nur bei einem Loopback-Testziel von SMOKE_BASE_URL abweichen.");
}
const publicHostHeaders = simulatePublicHost
  ? {
      host: new URL(PUBLIC_ORIGIN).host,
      "x-forwarded-host": new URL(PUBLIC_ORIGIN).host,
      "x-forwarded-proto": new URL(PUBLIC_ORIGIN).protocol.slice(0, -1),
    }
  : {};
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

const pageChecks = [
  { path: "/", markers: ["Fahrzeugaufbereitung", "White Gloss"] },
  { path: "/preise", markers: ["Pakete", "Preise"] },
  { path: "/leistungen", markers: ["Leistungsspektrum", "Leistungen"] },
  { path: "/abholservice", markers: ["Hol", "Bringservice"] },
  { path: "/faq", markers: ["Häufige Fragen"] },
  { path: "/kontakt", markers: ["Kontakt", "Arnistal"] },
  { path: "/galerie", markers: ["Werkstatt"] },
  { path: "/impressum", markers: ["Angaben gemäß", "White Gloss Detailing"] },
  { path: "/datenschutz", markers: ["Verantwortlicher", "IONOS"] },
  { path: "/agb", markers: ["Allgemeine Geschäftsbedingungen"] },
  { path: "/widerruf", markers: ["Widerrufsbelehrung"] },
  { path: "/login", markers: ["Betrieb"] },
  { path: "/admin", markers: [] },
  { path: "/b2b", markers: ["Firmenkunden"] },
  { path: "/luxusfahrzeuge", markers: ["Luxusfahrzeuge", "80.000"] },
  { path: "/qualitaet", markers: ["Wie wir arbeiten"] },
  { path: "/fahrzeug-zustand", markers: ["Zustand prüfen"] },
  { path: "/dellen-hagelschaden", markers: ["Dellenentfernung"] },
];

const forbiddenSnippets = [
  { id: "odr-platform", needle: "ec.europa.eu/consumers/odr" },
  { id: "old-domain", needle: "https://whitegloss.de" },
  { id: "stale-upload-claim", needle: "Dateien bleiben im Betrieb" },
  { id: "stale-10km-price", needle: "bis 10 km 20" },
  { id: "stale-deposit-20", needle: "Anzahlung von 20" },
  { id: "stale-deposit-20-label", needle: "Anzahlung Neukunde (20" },
  { id: "stale-pickup-lowercase", needle: "Neckar. bis 10" },
  { id: "public-signup", needle: "Noch kein Konto? Registrieren" },
  { id: "stale-ceramic-5y-product", needle: "Keramik 5 Jahre" },
  { id: "stale-ceramic-5y-item", needle: "5-Jahres-Beschichtung extra" },
  { id: "grok-extensions-on-prod", needle: "grok.com/grok-app-builder/extensions.js" },
];

const failures = [];

function fail(label, message) {
  failures.push(`${label}: ${message}`);
}

async function get(path, { redirect = "follow" } = {}) {
  const url = new URL(path, BASE_URL);
  const response = await fetch(url, {
    redirect,
    headers: {
      "user-agent": "WhiteGloss-Production-Smoke/1.0",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...publicHostHeaders,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.text();
  return { response, body, requestedUrl: url.href };
}

function assertCanonical(path, body) {
  const expected = new URL(path, `${PUBLIC_ORIGIN}/`).href.replace(/\/$/, path === "/" ? "/" : "");
  const canonicalPattern =
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>|<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i;
  const match = body.match(canonicalPattern);
  const canonical = match?.[1] || match?.[2];
  if (!canonical) {
    fail(path, "kein Canonical-Link im serverseitigen HTML gefunden");
    return;
  }
  if (canonical.replace(/\/$/, "") !== expected.replace(/\/$/, "")) {
    fail(path, `Canonical ist ${canonical}, erwartet ${expected}`);
  }
}

function assertSecurityHeaders(response) {
  const headers = response.headers;
  const requiredExact = [
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "SAMEORIGIN"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
  ];

  for (const [name, expected] of requiredExact) {
    const actual = headers.get(name);
    if (actual?.toLowerCase() !== expected.toLowerCase()) {
      fail("security-headers", `${name} ist ${actual || "nicht gesetzt"}; erwartet ${expected}`);
    }
  }

  const hsts = headers.get("strict-transport-security") || "";
  const hstsMatch = hsts.match(/max-age=(\d+)/i);
  const hstsMaxAge = hstsMatch ? Number(hstsMatch[1]) : NaN;
  if (!hstsMatch) {
    fail("security-headers", "Strict-Transport-Security mit max-age fehlt");
  } else if (!Number.isFinite(hstsMaxAge) || hstsMaxAge < 31536000) {
    fail(
      "security-headers",
      `Strict-Transport-Security max-age ist ${hstsMaxAge}; erwartet mindestens 31536000`,
    );
  }

  const permissions = headers.get("permissions-policy") || "";
  if (!permissions.includes("camera=()") || !permissions.includes("microphone=()")) {
    fail("security-headers", "Permissions-Policy sperrt Kamera/Mikrofon nicht wie erwartet");
  }

  const csp = headers.get("content-security-policy") || "";
  for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'self'"]) {
    if (!csp.includes(directive)) {
      fail("security-headers", `CSP-Direktive fehlt: ${directive}`);
    }
  }
}

function decodeXmlText(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value.replace(/&(amp|lt|gt|quot|apos|#x[0-9a-f]+|#\d+);/gi, (_, entity) => {
    if (entity.startsWith("#")) {
      const hex = entity[1].toLowerCase() === "x";
      return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return entities[entity.toLowerCase()];
  });
}

for (const check of pageChecks) {
  try {
    const { response, body } = await get(check.path);
    const label = check.path;
    if (!response.ok) {
      fail(label, `HTTP ${response.status}`);
      continue;
    }
    if (body.trim().length < 200) {
      fail(label, "Antwort ist unerwartet kurz");
    }
    for (const marker of check.markers) {
      if (!body.toLowerCase().includes(marker.toLowerCase())) {
        fail(label, `erwarteter Inhalt fehlt: ${marker}`);
      }
    }
    if (check.path !== "/admin" && check.path !== "/login") {
      assertCanonical(check.path, body);
    }
    for (const snippet of forbiddenSnippets) {
      if (body.includes(snippet.needle)) {
        fail(label, `verbotener Inhalt: ${snippet.id}`);
      }
    }
    if (check.path === "/") {
      assertSecurityHeaders(response);
      if (!/id=["']buchung["']/.test(body) && !/Terminanfrage/.test(body)) {
        fail(label, "Buchungsformular/Anker fehlt");
      }
    }
    if (check.path === "/preise") {
      if (
        !/bis 10 km kostenlos/i.test(body) ||
        !/bis 20 km 50/.test(body) ||
        !/bis 50 km 70/.test(body)
      ) {
        fail(label, "Abholstaffel (10 km kostenlos / 20 km 50 / 50 km 70) fehlt");
      }
      if (!/149/.test(body) || !/349/.test(body) || !/899/.test(body)) {
        fail(label, "Paketpreise 149/349/899 fehlen");
      }
    }
    if (check.path === "/login") {
      const loginText = body.replace(/<!--[\s\S]*?-->/g, "");
      if (/Noch kein Konto\? Registrieren/.test(loginText) || /Konto anlegen/.test(loginText)) {
        fail(label, "öffentliche Registrierung ist noch sichtbar");
      }
      if (!/Weiter mit Google/.test(loginText)) {
        fail(label, "Google-Anmeldung fehlt");
      }
      if (/Weiter mit X/.test(loginText)) {
        fail(label, "X-Anmeldung darf auf der Live-Anmeldung nicht sichtbar sein");
      }
    }
    if (check.path === "/impressum") {
      if (!/nicht verpflichtet und nicht bereit/.test(body)) {
        fail(label, "VSBG-Hinweis zur Verbraucherstreitbeilegung fehlt");
      }
    }
    if (check.path === "/datenschutz") {
      if (/wg-cookie/.test(body)) {
        fail(label, "Datenschutz erwähnt weiterhin wg-cookie");
      }
    }
    console.log(`PASS ${label} -> ${response.status} ${response.url}`);
  } catch (error) {
    fail(check.path, error instanceof Error ? error.message : String(error));
  }
}

try {
  const { response, body } = await get("/diese-seite-gibt-es-nicht");
  if (response.status !== 404) {
    fail("/404", `HTTP ${response.status}, erwartet 404`);
  } else if (!/(?:Seite nicht gefunden|Diese Seite gibt es nicht)/i.test(body)) {
    fail("/404", "deutsche 404-Meldung fehlt");
  } else {
    console.log(`PASS /404 -> ${response.status}`);
  }
} catch (error) {
  fail("/404", error instanceof Error ? error.message : String(error));
}

try {
  // Merkt sich den Stand vor den Prüfungen, damit unten nicht „PASS"
  // gemeldet wird, obwohl gerade etwas fehlgeschlagen ist.
  const fehlerVorher = failures.length;
  const { response, body } = await get("/sitemap.xml");
  if (!response.ok) fail("/sitemap.xml", `HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!/xml/i.test(contentType)) {
    fail("/sitemap.xml", `unerwarteter Content-Type: ${contentType || "leer"}`);
  }
  const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    decodeXmlText(match[1].trim()),
  );
  if (locations.length < 20) {
    fail("/sitemap.xml", `nur ${locations.length} URL-Einträge gefunden`);
  }
  const wrongOrigin = locations.filter((location) => !location.startsWith(`${PUBLIC_ORIGIN}/`));
  if (wrongOrigin.length > 0) {
    fail("/sitemap.xml", `${wrongOrigin.length} URL(s) liegen nicht auf ${PUBLIC_ORIGIN}`);
  }
  if (body.includes("https://whitegloss.de")) {
    fail("/sitemap.xml", "alte Domain whitegloss.de ist noch enthalten");
  }
  for (const required of ["/kontakt", "/galerie"]) {
    if (!locations.includes(`${PUBLIC_ORIGIN}${required}`)) {
      fail("/sitemap.xml", `${required} fehlt in der Sitemap`);
    }
  }
  if (failures.length === fehlerVorher) {
    console.log(`PASS /sitemap.xml -> ${response.status}, ${locations.length} URLs`);
  }

  /*
    JEDE ADRESSE AUS DER SITEMAP MUSS AUCH INDEXIERBAR SEIN.

    Eine Seite anzumelden und ihr dann „noindex" mitzugeben, ist für Google
    ein Widerspruch — und im schlimmsten Fall die Anweisung, sie aus dem
    Index zu werfen. Genau das ist am 11.08.2026 mit dem Ratgeber-Beitrag
    passiert: Die Datenbank war kurz nicht erreichbar, die Route lieferte
    „Beitrag nicht gefunden" samt noindex, und Google hat den Beitrag
    ausgetragen.

    Dieser Test greift ab sofort nach jedem Deployment und würde denselben
    Zustand sofort melden, statt ihn wochenlang unbemerkt zu lassen.
  */
  const indexProbleme = [];
  for (const location of locations) {
    const pfad = new URL(location).pathname;
    try {
      const seite = await get(pfad);
      if (!seite.response.ok) {
        indexProbleme.push(`${pfad} -> HTTP ${seite.response.status}`);
        continue;
      }
      const robotsTags = [...seite.body.matchAll(/<meta[^>]+name=["']robots["'][^>]*>/gi)].map(
        (treffer) => treffer[0],
      );
      if (robotsTags.some((tag) => /noindex/i.test(tag))) {
        indexProbleme.push(`${pfad} -> steht in der Sitemap, liefert aber noindex`);
      }
    } catch (error) {
      indexProbleme.push(`${pfad} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (indexProbleme.length > 0) {
    for (const problem of indexProbleme) fail("/sitemap.xml", problem);
  } else if (locations.length > 0) {
    console.log(`PASS Indexierbarkeit -> alle ${locations.length} Sitemap-URLs sind indexierbar`);
  }
} catch (error) {
  fail("/sitemap.xml", error instanceof Error ? error.message : String(error));
}

try {
  const { response, body } = await get("/robots.txt");
  if (!response.ok) fail("/robots.txt", `HTTP ${response.status}`);
  const expectedSitemap = `Sitemap: ${PUBLIC_ORIGIN}/sitemap.xml`;
  if (!body.includes(expectedSitemap)) {
    fail("/robots.txt", `Sitemap-Hinweis fehlt: ${expectedSitemap}`);
  }
  if (!/^User-agent:\s*\*/im.test(body) || !/^Allow:\s*\//im.test(body)) {
    fail("/robots.txt", "grundlegende Crawl-Regeln fehlen");
  }
  console.log(`PASS /robots.txt -> ${response.status}`);
} catch (error) {
  fail("/robots.txt", error instanceof Error ? error.message : String(error));
}

/*
  DIE BESTAETIGUNGSDATEIEN DER SEARCH CONSOLE MUESSEN ERREICHBAR BLEIBEN.

  Google prueft den Besitz einer Property, indem es die hinterlegte Datei
  abruft und den Inhalt vergleicht. Schlaegt das fehl, verliert die Property
  ihre Bestaetigung — und mit ihr die Adressaenderung, die Sitemap-Meldungen
  und die Indexierungsanfragen. Gemeldet wird das nur per E-Mail an das
  Google-Konto; im Betrieb faellt es sonst wochenlang nicht auf.

  Drei Dinge gehen dabei erfahrungsgemaess schief, alle drei stehen hier:

  1. Die Datei wird beim Aufraeumen aus `public/` entfernt.
  2. Eine Weiterleitung schiebt den Abruf auf eine andere Domain. Google
     folgt dabei nicht — fuer die Pruefung zaehlt nur, was unter der
     Property-Adresse selbst ausgeliefert wird.
  3. Statt der Datei antwortet die Anwendung mit ihrer HTML-Huelle. Der
     Statuscode ist dann 200, der Inhalt aber falsch.
*/
try {
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  const verificationFiles = readdirSync(publicDir).filter((name) =>
    /^google[a-z0-9]+\.html$/i.test(name),
  );

  if (verificationFiles.length === 0) {
    console.log("HINWEIS keine Bestaetigungsdateien in public/ — nichts zu pruefen");
  }

  for (const name of verificationFiles) {
    const label = `/${name}`;
    const erwartet = readFileSync(join(publicDir, name), "utf8").trim();
    try {
      const { response, body } = await get(label);

      if (!response.ok) {
        fail(label, `HTTP ${response.status}; Google kann den Besitz nicht pruefen`);
        continue;
      }
      if (new URL(response.url).origin !== BASE_URL) {
        fail(
          label,
          `Weiterleitung endet auf ${new URL(response.url).origin}; Google folgt ihr nicht`,
        );
        continue;
      }
      if (body.trim() !== erwartet) {
        fail(label, "ausgelieferter Inhalt weicht von der Datei in public/ ab");
        continue;
      }
      console.log(`PASS ${label} -> ${response.status}, Bestaetigung erreichbar`);
    } catch (error) {
      fail(label, error instanceof Error ? error.message : String(error));
    }
  }
} catch (error) {
  fail("site-verification", error instanceof Error ? error.message : String(error));
}

/*
  EIN BESTAETIGUNGS-META-TAG DARF NIE MIT LEEREM ODER UNGUELTIGEM WERT
  AUSGELIEFERT WERDEN.

  Steht `VITE_GOOGLE_SITE_VERIFICATION` beim Build nicht zur Verfuegung,
  entfaellt das Tag ersatzlos — das ist gewollt. Erscheint es dagegen mit
  leerem `content`, meldet Google die Bestaetigung als fehlgeschlagen, ohne
  einen Grund zu nennen.
*/
try {
  const { body } = await get("/");
  const tags = [...body.matchAll(/<meta[^>]+name=["']google-site-verification["'][^>]*>/gi)].map(
    (treffer) => treffer[0],
  );
  const leer = tags.filter((tag) => {
    const wert = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    return wert.trim().length === 0;
  });
  if (leer.length > 0) {
    fail("site-verification", `${leer.length} google-site-verification-Tag(s) ohne Wert`);
  } else if (tags.length > 0) {
    console.log(`PASS site-verification -> ${tags.length} Meta-Tag(s) mit Wert`);
  } else {
    console.log("HINWEIS kein google-site-verification-Meta-Tag gesetzt (Datei-Methode genuegt)");
  }
} catch (error) {
  fail("site-verification", error instanceof Error ? error.message : String(error));
}

try {
  const response = await fetch(new URL("/api/auth/sign-in/email", BASE_URL), {
    method: "POST",
    redirect: "manual",
    headers: {
      "user-agent": "WhiteGloss-Production-Smoke/1.0",
      accept: "application/json",
      "content-type": "application/json",
      origin: PUBLIC_ORIGIN,
      ...publicHostHeaders,
    },
    body: JSON.stringify({
      email: "smoke-origin-check@invalid.example",
      password: "not-a-real-password-xx",
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.text();
  if (/invalid origin/i.test(body) || response.status === 403) {
    fail(
      "/api/auth/sign-in/email",
      `Live-Origin wird nicht akzeptiert (${response.status}): ${body.slice(0, 180)}`,
    );
  } else if (response.ok) {
    fail("/api/auth/sign-in/email", "Anmeldung mit Dummy-Daten darf nicht gelingen");
  } else {
    console.log(`PASS /api/auth/sign-in/email origin -> ${response.status}`);
  }
} catch (error) {
  fail("/api/auth/sign-in/email", error instanceof Error ? error.message : String(error));
}

if (failures.length > 0) {
  console.error("\nProduction-Smoke-Test fehlgeschlagen:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nProduction-Smoke-Test erfolgreich für ${BASE_URL}`);
}

