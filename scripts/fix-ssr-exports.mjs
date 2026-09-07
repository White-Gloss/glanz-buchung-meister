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
 *
 * Two Nitro presets emit the same pair in different folders:
 *   node-server (IONOS)  → .output/server/_ssr
 *   vercel (local preview) → .vercel/output/functions/__server.func/_ssr
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { repairSsrNamespace } from "./ssr-namespace-repair.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ssrDirs = [
  {
    label: "node-server",
    ssrDir: join(root, ".output/server/_ssr"),
    runtimePath: join(root, ".output/server/_runtime.mjs"),
  },
  {
    label: "vercel",
    ssrDir: join(root, ".vercel/output/functions/__server.func/_ssr"),
    runtimePath: join(root, ".vercel/output/functions/__server.func/_runtime.mjs"),
  },
];

function fail(message) {
  console.error(`SSR-Check: ${message}`);
  process.exit(1);
}

function patchBundle({ label, ssrDir, runtimePath }) {
  const ssrPath = join(ssrDir, "ssr.mjs");
  const ssr2Path = join(ssrDir, "ssr2.mjs");
  if (!existsSync(ssrPath)) return false;

  if (existsSync(ssr2Path)) {
    let ssr2 = readFileSync(ssr2Path, "utf8");
    const cycle = /import\s*\{[^}]*__exportAll[^}]*\}\s*from\s*["']\.\/ssr\.mjs["']/.test(ssr2);
    if (cycle) {
      if (!existsSync(runtimePath) || !/__exportAll as r/.test(readFileSync(runtimePath, "utf8"))) {
        fail(`${label}: ssr2 importiert ssr.mjs zyklisch, _runtime.mjs hat kein __exportAll.`);
      }
      ssr2 = ssr2.replace(
        /import\s*\{[^}]*__exportAll[^}]*\}\s*from\s*["']\.\/ssr\.mjs["'];\n?/,
        'import { r as __exportAll$1 } from "../_runtime.mjs";\n',
      );
      if (/from\s*["']\.\/ssr\.mjs["']/.test(ssr2)) {
        fail(`${label}: ssr2 importiert ssr.mjs weiterhin.`);
      }
      writeFileSync(ssr2Path, ssr2);
      console.log(`SSR-Check (${label}): ssr2-Zyklus auf _runtime.mjs umgebogen.`);
    }
  }

  let src = readFileSync(ssrPath, "utf8");
  const repaired = repairSsrNamespace(src);
  if (repaired !== src) {
    writeFileSync(ssrPath, repaired);
    console.log(`SSR-Check (${label}): ssr_exports nachträglich gebunden.`);
  }

  src = readFileSync(ssrPath, "utf8");
  if (/\bssr_exports\s+as\s+[\w$]+/.test(src) && !/\b(?:var|let|const) ssr_exports\b/.test(src)) {
    fail(`${label}: ssr_exports bleibt ungebunden.`);
  }
  if (existsSync(ssr2Path) && /from\s*["']\.\/ssr\.mjs["']/.test(readFileSync(ssr2Path, "utf8"))) {
    fail(`${label}: ssr2 importiert ssr.mjs weiterhin (Zyklus).`);
  }
  const syntax = spawnSync(process.execPath, ["--check", ssrPath], { encoding: "utf8" });
  if (syntax.status !== 0) fail(`${label}: ${syntax.stderr || "Syntaxprüfung fehlgeschlagen"}`);
  console.log(`SSR-Check (${label}): Syntax- und Zyklusprüfung bestanden.`);
  return true;
}

let patched = 0;
for (const bundle of ssrDirs) {
  if (patchBundle(bundle)) patched += 1;
}
if (patched === 0) {
  console.log("SSR-Check: keine ssr.mjs gefunden (kein Nitro-Build).");
}
