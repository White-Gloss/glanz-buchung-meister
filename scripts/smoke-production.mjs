import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = new URL(process.env.SMOKE_BASE_URL || "https://white-gloss.de").origin;
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

const pageChecks = [
  { path: "/", markers: ["Fahrzeugaufbereitung", "White Gloss"] },
  { path: "/preise", markers: ["Pakete", "Preise"] },
  { path: "/leistungen", markers: ["Leistungsspektrum", "Leistungen"] },
  { path: "/admin", markers: [] },
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
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.text();
  return { response, body, requestedUrl: url.href };
}

function assertCanonical(path, body) {
  const expected = new URL(path, `${BASE_URL}/`).href.replace(/\/$/, path === "/" ? "/" : "");
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
  if (!/max-age=\d+/i.test(hsts)) {
    fail("security-headers", "Strict-Transport-Security mit max-age fehlt");
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
    if (check.path !== "/admin") {
      assertCanonical(check.path, body);
    }
    if (check.path === "/") {
      assertSecurityHeaders(response);
    }
    console.log(`PASS ${label} -> ${response.status} ${response.url}`);
  } catch (error) {
    fail(check.path, error instanceof Error ? error.message : String(error));
  }
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
  const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  if (locations.length < 20) {
    fail("/sitemap.xml", `nur ${locations.length} URL-Einträge gefunden`);
  }
  const wrongOrigin = locations.filter((location) => !location.startsWith(`${BASE_URL}/`));
  if (wrongOrigin.length > 0) {
    fail("/sitemap.xml", `${wrongOrigin.length} URL(s) liegen nicht auf ${BASE_URL}`);
  }
  if (body.includes("https://whitegloss.de")) {
    fail("/sitemap.xml", "alte Domain whitegloss.de ist noch enthalten");
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
  const expectedSitemap = `Sitemap: ${BASE_URL}/sitemap.xml`;
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

if (failures.length > 0) {
  console.error("\nProduction-Smoke-Test fehlgeschlagen:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nProduction-Smoke-Test erfolgreich für ${BASE_URL}`);
}
