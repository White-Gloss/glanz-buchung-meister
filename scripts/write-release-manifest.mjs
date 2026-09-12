import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Numbered SQL stays in migrations/ for `db:migrate`, but these integrations
 * already apply the same DDL at runtime (ensureZohoSchema / ensureBitrixSchema),
 * the Lexware pattern. Including them in the GET / gate 503s every IONOS
 * activate until a root shell can migrate — GitHub CI cannot.
 */
export const RUNTIME_ENSURED_MIGRATIONS = ["0015_zoho_ops.sql", "0016_bitrix_sync.sql"];

/** @param {string[]} names */
export function requiredReleaseMigrations(names) {
  return names
    .filter((name) => name.endsWith(".sql") && !RUNTIME_ENSURED_MIGRATIONS.includes(name))
    .sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = requiredReleaseMigrations(
    await readdir(new URL("../migrations/", import.meta.url)),
  );
  await writeFile(
    new URL("../server/release-migrations.generated.json", import.meta.url),
    JSON.stringify(names, null, 2) + "\n",
  );
  console.log(`[release] ${names.length} erforderliche Migrationen im Build vermerkt.`);
}
