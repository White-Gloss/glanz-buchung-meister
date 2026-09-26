#!/usr/bin/env node
/** Write server-only ERPNext embed from CI secrets. Does not log the secret. */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/lib/erpnext.generated.ts");
const apiKey = (process.env.ERPNEXT_API_KEY || "").trim();
const apiSecret = (process.env.ERPNEXT_API_SECRET || "").trim();
const baseUrl = (process.env.ERPNEXT_BASE_URL || "").trim();

const body =
  apiKey && apiSecret
    ? `/** Generated at build. Do not commit secrets. */\nexport const EMBEDDED_ERPNEXT = {\n  baseUrl: ${baseUrl ? JSON.stringify(baseUrl) : "undefined"},\n  apiKey: ${JSON.stringify(apiKey)},\n  apiSecret: ${JSON.stringify(apiSecret)},\n};\n`
    : `/** Filled by CI when ERPNEXT_API_KEY/SECRET exist. Never commit real secrets. */\nexport const EMBEDDED_ERPNEXT: { baseUrl?: string; apiKey: string; apiSecret: string } | null = null;\n`;

writeFileSync(out, body);
console.log(
  apiKey && apiSecret
    ? "ERPNext: eingebettet (Schlüssel gesetzt)."
    : "ERPNext: nicht eingebettet (keine CI-Geheimnisse).",
);
