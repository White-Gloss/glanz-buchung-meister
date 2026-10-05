#!/usr/bin/env node
// Prepare a separate private environment file. Never activate it or restart a service.
// node scripts/stage-panel-environment.mjs --source=... --output=...
import { lstat, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvironment } from "./cutover-bitrix-production.mjs";

export function panelEnvironment(source) {
  const values = parseEnvironment(source);
  if (!values.DATABASE_URL) throw new Error("database_configuration_missing");
  const kept = source.split(/\r?\n/).filter((line) => line.split("=")[0].trim() !== "BOOKING_OPERATIONS");
  while (kept.at(-1) === "") kept.pop();
  return [...kept, "BOOKING_OPERATIONS=panel", ""].join("\n");
}

async function privateFile(path, maximum) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum)
    throw new Error("invalid_input_file");
  if (process.platform !== "win32" && (info.uid !== 0 || (info.mode & 0o077) !== 0))
    throw new Error("input_must_be_root_private");
  return readFile(path, "utf8");
}

export async function stagePanelEnvironment({ source, output }) {
  if (resolve(source) === resolve(output))
    throw new Error("separate_output_required");
  const parent = await lstat(dirname(resolve(output)));
  if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error("invalid_output_directory");
  if (process.platform !== "win32" && (parent.uid !== 0 || (parent.mode & 0o022) !== 0))
    throw new Error("output_directory_must_be_root_protected");
  const original = await privateFile(source, 1024 * 1024);
  const prepared = panelEnvironment(original);
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
    mode: "panel",
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
      Object.keys(args).some((key) => !["--source", "--output"].includes(key)) ||
      !args["--source"] ||
      !args["--output"]
    )
      throw new Error("invalid_arguments");
    console.log(
      JSON.stringify(
        await stagePanelEnvironment({
          source: args["--source"] || "/etc/white-gloss/environment",
          output: args["--output"],
        }),
      ),
    );
  } catch {
    console.error(
      "Panel environment staging failed; check private input/output files. No credentials logged, no activation performed.",
    );
    process.exitCode = 1;
  }
}
