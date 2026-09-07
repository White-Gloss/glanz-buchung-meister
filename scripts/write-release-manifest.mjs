import { readdir, writeFile } from "node:fs/promises";
const names = (await readdir(new URL("../migrations/", import.meta.url)))
  .filter((name) => name.endsWith(".sql"))
  .sort();
await writeFile(
  new URL("../server/release-migrations.generated.json", import.meta.url),
  JSON.stringify(names, null, 2) + "\n",
);
console.log(`[release] ${names.length} erforderliche Migrationen im Build vermerkt.`);
