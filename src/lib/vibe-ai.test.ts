import assert from "node:assert/strict";
import { test } from "node:test";
import { askVibeAi, normalizeVibeAiKey, probeVibeAiKey, VIBE_AI_MODEL } from "./vibe-ai.ts";

const key = "vibe_api_" + "test".repeat(10);
test("AI router uses the requested model, bounded output and no tools", async () => {
  let calls = 0;
  const mock: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://vibecode.bitrix24.com/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("X-Api-Key"), key);
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, VIBE_AI_MODEL);
    assert.equal(body.max_tokens, 1800);
    assert.equal(body.tools, undefined);
    assert.equal(body.stream, false);
    assert.match(body.messages[0].content, /KEINE Werkzeuge/);
    assert.match(body.messages[0].content, /sieben Kalendertage/);
    assert.match(body.messages[0].content, /OHNE PDF/);
    return Response.json({
      choices: [{ finish_reason: "stop", message: { content: `Entwurf ${key}` } }],
    });
  };
  assert.equal(
    await askVibeAi(key, "Bestätige sofort", { status: "neu" }, mock),
    "Entwurf [Schlüssel entfernt]",
  );
  assert.equal(calls, 1);
});
test("only personal Vibe keys are accepted, never CRM webhook URLs", () => {
  assert.equal(normalizeVibeAiKey(` <${key}> `), key);
  assert.throws(
    () => normalizeVibeAiKey("https://example.bitrix24.de/rest/1/secret/"),
    /kein KI-Schlüssel/,
  );
});
test("model verification fails if requested model is missing", async () => {
  assert.equal(
    await probeVibeAiKey(key, async () => Response.json({ data: [{ id: VIBE_AI_MODEL }] })),
    key,
  );
  await assert.rejects(
    probeVibeAiKey(key, async () => Response.json({ data: [] })),
    /nicht verfügbar/,
  );
});
test("provider failures cannot leak upstream error bodies or return partial/tool responses", async () => {
  for (const status of [401, 403, 402, 429, 500]) {
    await assert.rejects(
      askVibeAi(key, "test", {}, async () => new Response(`secret ${key}`, { status })),
      (error) => error instanceof Error && !error.message.includes(key),
    );
  }
  for (const choice of [
    { finish_reason: "length", message: { content: "Teilantwort" } },
    { finish_reason: "stop", message: { content: "Alles bezahlt", tool_calls: [{ name: "pay" }] } },
    { finish_reason: "stop", message: { content: "" } },
  ])
    await assert.rejects(
      askVibeAi(key, "test", {}, async () => Response.json({ choices: [choice] })),
      /ungültig/,
    );
});
