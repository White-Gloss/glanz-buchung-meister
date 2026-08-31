#!/usr/bin/env node
/**
 * Rolldown may split the TanStack Start SSR entry into ssr.mjs + ssr2.mjs.
 * That split is circular:
 *   ssr.mjs imports ssr2.mjs
 *   ssr2.mjs imports __exportAll from ssr.mjs before ssr.mjs finished evaluating
 * Nitro then 500s every HTML request (`ssr_exports` unbound, or `__exportAll is not a function`).
 *
 * Repair:
 *   1. Point ssr2's __exportAll at _runtime.mjs (already evaluated, no cycle).
 *   2. Bind `ssr_exports` on ssr.mjs so Nitro's `import(ssr.mjs).then(n => n.s)` works.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ssrDir = join(root, ".output/server/_ssr");
const ssrPath = join(ssrDir, "ssr.mjs");
const ssr2Path = join(ssrDir, "ssr2.mjs");
const runtimePath = join(root, ".output/server/_runtime.mjs");

if (!existsSync(ssrPath)) {
  console.log("SSR-Check: keine .output/server/_ssr/ssr.mjs (kein node-server Build).");
  process.exit(0);
}

function fail(message) {
  console.error(`SSR-Check: ${message}`);
  process.exit(1);
}

if (existsSync(ssr2Path)) {
  let ssr2 = readFileSync(ssr2Path, "utf8");
  const cycle = /import\s*\{[^}]*__exportAll[^}]*\}\s*from\s*["']\.\/ssr\.mjs["']/.test(ssr2);
  if (cycle) {
    if (!existsSync(runtimePath) || !/__exportAll as r/.test(readFileSync(runtimePath, "utf8"))) {
      fail("ssr2 importiert ssr.mjs zyklisch, _runtime.mjs hat kein __exportAll.");
    }
    ssr2 = ssr2.replace(
      /import\s*\{[^}]*__exportAll[^}]*\}\s*from\s*["']\.\/ssr\.mjs["'];\n?/,
      'import { r as __exportAll$1 } from "../_runtime.mjs";\n',
    );
    if (/from\s*["']\.\/ssr\.mjs["']/.test(ssr2)) {
      fail("ssr2 importiert ssr.mjs weiterhin.");
    }
    writeFileSync(ssr2Path, ssr2);
    console.log("SSR-Check: ssr2-Zyklus auf _runtime.mjs umgebogen.");
  }
}

let src = readFileSync(ssrPath, "utf8");
const defined = /\b(?:var|let|const) ssr_exports\b/.test(src);
const exported = /ssr_exports as s/.test(src);

if (!defined && exported) {
  const helper = src.match(/\bvar (__exportAll(?:\$\d+)?)\s*=/)?.[1];
  if (!helper) fail("ssr_exports fehlt und kein __exportAll zum Reparieren.");
  if (!/\bserver_default\b/.test(src) || !/\bserver_exports\b/.test(src)) {
    fail("server_default/server_exports fehlen, Patch unsicher.");
  }
  const marker = "export {";
  const at = src.lastIndexOf(marker);
  if (at < 0) fail("kein export-Block zum Patchen.");
  const injection = `var ssr_exports = ${helper}({\n\tdefault: () => server_default,\n\tt: () => server_exports\n});\n`;
  src = src.slice(0, at) + injection + src.slice(at);
  writeFileSync(ssrPath, src);
  console.log("SSR-Check: ssr_exports nachträglich gebunden.");
}

src = readFileSync(ssrPath, "utf8");
if (/ssr_exports as s/.test(src) && !/\b(?:var|let|const) ssr_exports\b/.test(src)) {
  fail("ssr_exports bleibt ungebunden.");
}
if (existsSync(ssr2Path) && /from\s*["']\.\/ssr\.mjs["']/.test(readFileSync(ssr2Path, "utf8"))) {
  fail("ssr2 importiert ssr.mjs weiterhin (Zyklus).");
}
console.log("SSR-Check: SSR-Entry ist ladbar.");
