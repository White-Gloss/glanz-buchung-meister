#!/usr/bin/env node
/** Write server-only Google OAuth embed from CI secrets. Does not log the secret. */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/lib/auth/google-oauth.generated.ts");
const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

const body =
  clientId && clientSecret
    ? `/** Generated at build. Do not commit secrets. */\nexport const EMBEDDED_GOOGLE_OAUTH = {\n  clientId: ${JSON.stringify(clientId)},\n  clientSecret: ${JSON.stringify(clientSecret)},\n};\n`
    : `/** Filled by CI when GOOGLE_CLIENT_ID/SECRET exist. Never commit real secrets. */\nexport const EMBEDDED_GOOGLE_OAUTH: { clientId: string; clientSecret: string } | null = null;\n`;

writeFileSync(out, body);
console.log(
  clientId && clientSecret
    ? "Google-OAuth: eingebettet (Client-ID gesetzt)."
    : "Google-OAuth: nicht eingebettet (keine CI-Geheimnisse).",
);
