#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENDPOINT = "http://127.0.0.1:3000/api/automation-cron";
export const HTTP_TIMEOUT_MS = 55_000;
const MAX_RESPONSE_BYTES = 8192;
const COUNT_KEYS = ["remindersChecked", "sent", "failed", "skipped", "retried", "review"];

async function readCounts(response, signal) {
  if (!response.body) throw new Error("invalid_response");
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  const chunks = [];
  let length = 0;
  try {
    if (signal.aborted) throw new Error("request_aborted");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("invalid_response");
      }
      chunks.push(value);
    }
    const data = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
    if (!data || typeof data !== "object" || data.ok !== true) throw new Error("invalid_response");
    for (const key of COUNT_KEYS) {
      if (!Number.isSafeInteger(data[key]) || data[key] < 0 || data[key] > 1_000_000) {
        throw new Error("invalid_response");
      }
    }
    // Never copy arbitrary fields, error details, URLs or customer data into the journal.
    return COUNT_KEYS.map((key) => `${key}=${data[key]}`).join(" ");
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

/** Injectable transport for isolated tests. Production has no configurable destination. */
export async function runNotifications({ env = process.env, fetchImpl = fetch } = {}) {
  const secret = env.REMINDER_CRON_SECRET?.trim() ?? "";
  if (secret.length < 32 || secret.length > 4096 || /[\r\n]/.test(secret)) {
    return { exitCode: 1, message: "[notifications] Konfiguration unvollständig." };
  }
  const controller = new AbortController();
  let timeout;
  try {
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("request_timeout"));
      }, HTTP_TIMEOUT_MS);
    });
    const request = (async () => {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      });
      if (!response.ok) {
        // Do not read an error response: it might contain private application details.
        await response.body?.cancel();
        throw new Error("request_failed");
      }
      return readCounts(response, controller.signal);
    })();
    const counts = await Promise.race([request, deadline]);
    return { exitCode: 0, message: `[notifications] OK ${counts}` };
  } catch {
    return {
      exitCode: 1,
      message: controller.signal.aborted
        ? "[notifications] Zeitlimit überschritten."
        : "[notifications] Verarbeitung fehlgeschlagen.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runNotifications();
  console.log(result.message);
  process.exitCode = result.exitCode;
}
