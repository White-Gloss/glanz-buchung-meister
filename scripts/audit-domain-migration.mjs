const OLD_BASE = new URL(process.env.MIGRATION_OLD_BASE || "https://whitegloss.de").origin;
const NEW_BASE = new URL(process.env.MIGRATION_NEW_BASE || "https://white-gloss.de").origin;
const REQUEST_TIMEOUT_MS = Number(process.env.MIGRATION_TIMEOUT_MS || 15000);

const paths = [
  "/",
  "/leistungen",
  "/preise",
  "/qualitaet",
  "/abholservice",
  "/faq",
  "/ratgeber",
];

const failures = [];

function normalize(url) {
  const parsed = new URL(url);
  if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/$/, "");
  parsed.hash = "";
  return parsed.href;
}

function fail(path, message) {
  failures.push(`${path}: ${message}`);
}

for (const path of paths) {
  const oldUrl = new URL(path, `${OLD_BASE}/`);
  const expectedNewUrl = new URL(path, `${NEW_BASE}/`);

  try {
    const response = await fetch(oldUrl, {
      redirect: "manual",
      headers: { "user-agent": "WhiteGloss-Domain-Migration-Audit/1.0" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (![301, 308].includes(response.status)) {
      fail(path, `alte URL liefert HTTP ${response.status}; erwartet permanent 301 oder 308`);
      continue;
    }

    const location = response.headers.get("location");
    if (!location) {
      fail(path, "permanente Weiterleitung ohne Location-Header");
      continue;
    }

    const resolvedLocation = new URL(location, oldUrl);
    if (normalize(resolvedLocation) !== normalize(expectedNewUrl)) {
      fail(path, `Ziel ist ${resolvedLocation.href}; erwartet ${expectedNewUrl.href}`);
      continue;
    }

    const finalResponse = await fetch(resolvedLocation, {
      redirect: "follow",
      headers: { "user-agent": "WhiteGloss-Domain-Migration-Audit/1.0" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!finalResponse.ok) {
      fail(path, `neue Ziel-URL liefert HTTP ${finalResponse.status}`);
      continue;
    }

    if (new URL(finalResponse.url).origin !== NEW_BASE) {
      fail(path, `Weiterleitung endet auf fremdem Origin: ${finalResponse.url}`);
      continue;
    }

    console.log(`PASS ${oldUrl.href} -> ${response.status} -> ${finalResponse.url}`);
  } catch (error) {
    fail(path, error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error("\nDomain-Migrationsaudit fehlgeschlagen:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nDomain-Migrationsaudit erfolgreich: ${OLD_BASE} -> ${NEW_BASE}`);
}
