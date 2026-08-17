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

if (failures.length > 0) {
  console.error("\nProduction-Smoke-Test fehlgeschlagen:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nProduction-Smoke-Test erfolgreich für ${BASE_URL}`);
}
