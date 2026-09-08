#!/usr/bin/env node
/** Write server-only Odoo embed from CI secrets. Does not log the secret. */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/lib/odoo.generated.ts");
const apiKey = (process.env.ODOO_API_KEY || "").trim();
const baseUrl = (process.env.ODOO_BASE_URL || "").trim();
const database = (process.env.ODOO_DATABASE || "").trim();

const body = apiKey
  ? `/** Generated at build. Do not commit secrets. */\nexport const EMBEDDED_ODOO = {\n  baseUrl: ${baseUrl ? JSON.stringify(baseUrl) : "undefined"},\n  database: ${database ? JSON.stringify(database) : "undefined"},\n  apiKey: ${JSON.stringify(apiKey)},\n};\n`
  : `/** Filled by CI when ODOO_API_KEY exists. Never commit real secrets. */\nexport const EMBEDDED_ODOO: { baseUrl?: string; database?: string; apiKey: string } | null = null;\n`;

writeFileSync(out, body);
console.log(
  apiKey
    ? "Odoo: eingebettet (Schlüssel gesetzt)."
    : "Odoo: nicht eingebettet (kein CI-Geheimnis).",
);
