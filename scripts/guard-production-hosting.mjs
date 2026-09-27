import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const IMPORT = 'import "./hosting-policy-entry.mjs";\n';

// Nitro's compiled hook also protects builds produced by a direct `vite build`.
// The first dependency throws before the application's imports or socket setup.
export async function guardProductionHosting(serverDirectory) {
  const entry = join(serverDirectory, "index.mjs");
  const source = await readFile(entry, "utf8");
  await copyFile(new URL("./hosting-policy.mjs", import.meta.url), join(serverDirectory, "hosting-policy.mjs"));
  await writeFile(join(serverDirectory, "hosting-policy-entry.mjs"),
    'import { assertProductionHosting } from "./hosting-policy.mjs";\nassertProductionHosting(import.meta.url);\n');
  if (source.startsWith(IMPORT) || source.includes("\n" + IMPORT)) return;
  const shebangEnd = source.startsWith("#!") ? source.indexOf("\n") + 1 : 0;
  await writeFile(entry, source.slice(0, shebangEnd) + IMPORT + source.slice(shebangEnd));
}
