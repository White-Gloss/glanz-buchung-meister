import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { HTTP_TIMEOUT_MS, runNotifications } from "./run-notifications.mjs";

const secret = 'synthetic-only-secret-with-"quotes"-and-$-characters';
const env = { REMINDER_CRON_SECRET: secret };
const counts = { remindersChecked: 3, sent: 2, failed: 1, skipped: 0, retried: 4, review: 0 };
const good = () => Response.json({ ok: true, ...counts });

test("missing, short and invalid secrets fail without a request or value disclosure", async () => {
  for (const value of [
    undefined,
    "private-short",
    " ",
    `${secret}\r\ninjected`,
    "a".repeat(4097),
  ]) {
    let calls = 0;
    const result = await runNotifications({
      env: { REMINDER_CRON_SECRET: value },
      fetchImpl: () => {
        calls++;
        throw new Error("must not fetch");
      },
    });
    assert.equal(result.exitCode, 1);
    assert.equal(calls, 0);
    assert.equal(result.message, "[notifications] Konfiguration unvollständig.");
  }
});

test("posts exact Bearer header to the fixed loopback endpoint and logs only bounded counters", async () => {
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/automation-cron");
    assert.equal(request.headers.authorization, `Bearer ${secret}`);
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        ok: true,
        ...counts,
        customer: "private customer",
        secret,
        stack: "private stack",
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const result = await runNotifications({
      env: {
        ...env,
        SMOKE_BASE_URL: "https://ignored.invalid",
        NOTIFICATION_URL: "https://ignored.invalid",
      },
      fetchImpl: (url, options) => {
        assert.equal(url, "http://127.0.0.1:3000/api/automation-cron");
        assert.equal(options.redirect, "error");
        assert.ok(options.signal instanceof AbortSignal);
        return fetch(`http://127.0.0.1:${server.address().port}/api/automation-cron`, options);
      },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(requests, 1);
    assert.equal(
      result.message,
      "[notifications] OK remindersChecked=3 sent=2 failed=1 skipped=0 retried=4 review=0",
    );
    assert.doesNotMatch(result.message, /private|secret|stack/);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});

test("non-2xx, redirects, network failures and private response details produce one generic failure", async () => {
  const transports = [
    ...[301, 401, 429, 500, 503].map(
      (status) => async () => new Response(`private ${secret}`, { status }),
    ),
    async () => {
      throw new Error(`private connection ${secret}`);
    },
  ];
  for (const fetchImpl of transports) {
    const result = await runNotifications({ env, fetchImpl });
    assert.equal(result.exitCode, 1);
    assert.equal(result.message, "[notifications] Verarbeitung fehlgeschlagen.");
  }
});

test("rejects malformed, oversized, unsuccessful or unbounded success responses", async () => {
  const responses = [
    new Response("private invalid JSON"),
    new Response("x".repeat(8193)),
    Response.json({ ok: false, ...counts, error: secret }),
    Response.json({ ok: true, ...counts, sent: secret }),
    ...[-1, 1.5, 1_000_001, null].map((sent) => Response.json({ ok: true, ...counts, sent })),
    Response.json({ ok: true, sent: 1 }),
  ];
  for (const response of responses) {
    const result = await runNotifications({ env, fetchImpl: async () => response });
    assert.equal(result.exitCode, 1);
    assert.equal(result.message, "[notifications] Verarbeitung fehlgeschlagen.");
  }
});

test("aborts after 55 seconds without retrying even if the transport never settles", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let signal;
  const pending = runNotifications({
    env,
    fetchImpl: async (_url, options) => {
      calls++;
      signal = options.signal;
      return new Promise(() => {});
    },
  });
  t.mock.timers.tick(HTTP_TIMEOUT_MS - 1);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  const result = await pending;
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
  assert.equal(result.exitCode, 1);
  assert.equal(result.message, "[notifications] Zeitlimit überschritten.");
});

test("deadline also cancels a stalled response body", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let cancelled = false;
  const pending = runNotifications({
    env,
    fetchImpl: async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      ),
  });
  await Promise.resolve();
  t.mock.timers.tick(HTTP_TIMEOUT_MS);
  assert.equal((await pending).exitCode, 1);
  assert.equal(cancelled, true);
  // A subsequent run uses an independent controller/timer.
  assert.equal((await runNotifications({ env, fetchImpl: async () => good() })).exitCode, 0);
});

test("standalone CLI returns exit 1 for missing configuration without a stack trace", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./run-notifications.mjs", import.meta.url))],
    {
      env: { ...process.env, REMINDER_CRON_SECRET: "" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.trim(), "[notifications] Konfiguration unvollständig.");
});
