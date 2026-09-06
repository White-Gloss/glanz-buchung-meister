import pg from "pg";
import { readdir } from "node:fs/promises";
import { checkReleaseSchema, releaseConfigurationProblems } from "./release-policy.mjs";

const problems = releaseConfigurationProblems(process.env);
if (problems.length) {
  for (const problem of problems) console.error(`[release] ${problem}`);
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL.trim(),
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  try {
    const names = (await readdir(new URL("../migrations/", import.meta.url))).filter((name) =>
      name.endsWith(".sql"),
    );
    const issues = await checkReleaseSchema((text) => pool.query(text), names);
    for (const issue of issues) console.error(`[release] ${issue}`);
    if (issues.length) process.exitCode = 1;
    else
      console.log(
        "[release] Konfiguration, kompatibles Schema und Migrationen vollständig geprüft (nur lesend).",
      );
  } catch {
    console.error(
      "[release] Datenbankprüfung fehlgeschlagen. Verbindung und Berechtigungen am Server prüfen; keine Zugangsdaten protokolliert.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
