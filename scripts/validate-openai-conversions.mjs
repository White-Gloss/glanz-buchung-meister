// Run on the server with its protected runtime environment. Never print the key.
import { randomUUID } from "node:crypto";

const key = process.env.OPENAI_CONVERSIONS_API_KEY;
const pixel = process.env.OPENAI_CONVERSIONS_PIXEL_ID;
if (!key || !pixel) throw new Error("OpenAI conversion configuration is missing");
const response = await fetch(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixel)}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  redirect: "error",
  signal: AbortSignal.timeout(10000),
  body: JSON.stringify({
    validate_only: true,
    events: [{
      id: randomUUID(), type: "lead_created", timestamp_ms: Date.now(),
      source_url: "https://white-gloss.de/", action_source: "web", opt_out: true,
      data: { type: "customer_action" },
    }],
  }),
});
console.log(`OpenAI validation-only: HTTP ${response.status}`);
if (!response.ok) process.exitCode = 1;
