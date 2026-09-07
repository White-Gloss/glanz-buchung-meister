#!/usr/bin/env node
// Linux root only. Reads the initial process environment, not later runtime changes.
// No process attachment, signals, writes, .env loading, database or provider calls.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectConfiguration } from "./inspect-production.mjs";

export function parseProcessEnvironment(raw) {
  const env = Object.create(null);
  for (const entry of raw.toString("utf8").split("\0")) {
    const separator = entry.indexOf("=");
    if (separator > 0) env[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return env;
}

export async function inspectProcessEnvironment(
  pid,
  { read = readFile, platform = process.platform, uid = process.getuid?.() } = {},
) {
  if (typeof pid !== "string" || !/^[1-9]\d*$/.test(pid) || !Number.isSafeInteger(Number(pid)))
    throw new Error("invalid_pid");
  if (platform !== "linux" || uid !== 0) throw new Error("linux_root_required");
  let raw;
  try {
    raw = await read(`/proc/${pid}/environ`);
  } catch {
    throw new Error("process_environment_unreadable");
  }
  const { fields, database } = inspectConfiguration(parseProcessEnvironment(raw));
  return { fields, database };
}

export async function main(args = process.argv.slice(2)) {
  try {
    if (args.length !== 1) throw new Error("invalid_pid");
    console.log(JSON.stringify(await inspectProcessEnvironment(args[0])));
  } catch (error) {
    const known = ["invalid_pid", "linux_root_required", "process_environment_unreadable"];
    console.error(
      JSON.stringify({
        error: known.includes(error?.message) ? error.message : "inspection_failed",
      }),
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
