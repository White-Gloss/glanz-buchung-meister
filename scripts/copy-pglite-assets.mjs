import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const dest = join(root, ".vercel/output/functions/__server.func/_libs");
if (!existsSync(dest) || !existsSync(srcDir)) process.exit(0);
mkdirSync(dest, { recursive: true });
for (const name of readdirSync(srcDir)) {
  if (name.endsWith(".wasm") || name.endsWith(".data")) {
    copyFileSync(join(srcDir, name), join(dest, name));
  }
}
