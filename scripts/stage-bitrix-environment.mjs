#!/usr/bin/env node
// Prepare a separate private environment file. Never activate it or restart a service.
// node scripts/stage-bitrix-environment.mjs --webhook-file=... --output=...
import { lstat, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describeKey, parseEnvironment } from "./cutover-bitrix-production.mjs";

export function bitrixEnvironment(source, rawWebhook) {
  const webhook = rawWebhook.trim();
  if (describeKey(webhook).kind !== "rest_webhook") throw new Error("native_webhook_required");
  if (!parseEnvironment(source).DATABASE_URL) throw new Error("database_configuration_missing");
  const lines = source.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const kept = lines.filter(
    (line) => !["BOOKING_OPERATIONS", "BITRIX_WEBHOOK_URL"].includes(line.split("=")[0].trim()),
  );
  return [...kept, "BOOKING_OPERATIONS=bitrix", `BITRIX_WEBHOOK_URL=${webhook}`, ""].join("\n");
}

async function privateFile(path, maximum) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum)
    throw new Error("invalid_input_file");
  if (process.platform !== "win32" && (info.uid !== 0 || (info.mode & 0o077) !== 0))
    throw new Error("input_must_be_root_private");
  return readFile(path, "utf8");
}

export async function stageBitrixEnvironment({ source, webhookFile, output }) {
  if ([source, webhookFile].some((path) => resolve(path) === resolve(output)))
    throw new Error("separate_output_required");
  const parent = await lstat(dirname(resolve(output)));
  if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error("invalid_output_directory");
  if (process.platform !== "win32" && (parent.uid !== 0 || (parent.mode & 0o022) !== 0))
    throw new Error("output_directory_must_be_root_protected");
  const original = await privateFile(source, 1024 * 1024);
  const prepared = bitrixEnvironment(original, await privateFile(webhookFile, 2048));
  // Exclusive creation refuses existing files and symlinks. The active file stays untouched.
  const handle = await open(output, "wx", 0o600);
  try {
    await handle.writeFile(prepared, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  if (
    (await readFile(output, "utf8")) !== prepared ||
    (await readFile(source, "utf8")) !== original
  )
    throw new Error("environment_verification_failed");
  return {
    ok: true,
    activated: false,
    mode: "bitrix",
    webhook: "native_rest",
    sourceUnchanged: true,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.getuid?.() !== 0) throw new Error("root_required");
    const args = Object.fromEntries(
      process.argv.slice(2).map((value) => {
        const at = value.indexOf("=");
        if (at < 0) throw new Error("named_arguments_required");
        return [value.slice(0, at), value.slice(at + 1)];
      }),
    );
    if (
      Object.keys(args).some((key) => !["--source", "--webhook-file", "--output"].includes(key)) ||
      !args["--webhook-file"] ||
      !args["--output"]
    )
      throw new Error("invalid_arguments");
    console.log(
      JSON.stringify(
        await stageBitrixEnvironment({
          source: args["--source"] || "/etc/white-gloss/environment",
          webhookFile: args["--webhook-file"],
          output: args["--output"],
        }),
      ),
    );
  } catch {
    console.error(
      "Bitrix environment staging failed; check private input/output files. No credentials logged, no activation performed.",
    );
    process.exitCode = 1;
  }
}
