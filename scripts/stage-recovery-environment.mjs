#!/usr/bin/env node
/** Stage a private EnvironmentFile for review; never activate it or run the app.
 * Linux root: --directory /var/backups/white-gloss/YYYYMMDDTHHMMSSZ
 * --target-env <protected target.env> --signing-secret <protected auth-signing-secret.txt>
 * Existing assignments are preserved byte-for-byte. Unsupported multiline syntax,
 * duplicate keys, empty required assignments and conflicting recovery values fail closed.
 */
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGINAL = "/etc/white-gloss/environment";
const CURRENT = "/srv/white-gloss-current";
const GOOGLE_SUFFIX = "/src/lib/auth/google-oauth.generated.ts";
const ORIGIN = "https://white-gloss.de";
const BACKUP = /^\/var\/backups\/white-gloss\/\d{8}T\d{6}Z$/;
const RECOVERY_NAME = /^white_gloss_recovery_[a-z0-9][a-z0-9_]{0,31}$/;
const NULL_GOOGLE = "/** Filled by CI when GOOGLE_CLIENT_ID/SECRET exist. Never commit real secrets. */\nexport const EMBEDDED_GOOGLE_OAUTH: { clientId: string; clientSecret: string } | null = null;\n";
const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "REMINDER_CRON_SECRET", "BETTER_AUTH_URL"];

class StageError extends Error {}
function fail(code) { throw new StageError(code); }
function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function trimEnvironmentWhitespace(value) { return value.replace(/^[ \t\r]+|[ \t\r]+$/g, ""); }
function decode(bytes, max) {
  if (!Buffer.isBuffer(bytes) || bytes.length > max) fail("input_size_invalid");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { fail("input_encoding_invalid"); }
  if (text.includes("\uFEFF") || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text))
    fail("input_control_character");
  return text;
}
function scalar(value, max = 8192) {
  if (typeof value !== "string" || !value || value.length > max || value !== value.trim() || /[\u0000-\u001F\u007F]/.test(value))
    fail("required_value_invalid");
  return value;
}

// Deliberately supports only complete, single-line systemd EnvironmentFile values.
// There is no shell expansion: $, %, backticks and interior quotes remain literal.
export function parseEnvironment(bytes) {
  const text = decode(bytes, 262144);
  const values = new Map();
  for (const raw of text.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.includes("\r")) fail("environment_multiline_unsupported");
    if (/^[ \t]*(?:[#;].*)?$/.test(line)) continue;
    const assignment = /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*=(.*)$/.exec(line);
    if (!assignment) fail("environment_assignment_invalid");
    const [, key, rest] = assignment;
    if (values.has(key)) fail("environment_duplicate_key");
    const source = trimEnvironmentWhitespace(rest);
    let value = "";
    if (source.startsWith("'") || source.startsWith('"')) {
      const quote = source[0];
      let closed = false;
      for (let i = 1; i < source.length; i++) {
        const char = source[i];
        if (char === quote) {
          if (trimEnvironmentWhitespace(source.slice(i + 1))) fail("environment_quoted_suffix_unsupported");
          closed = true;
          break;
        }
        if (char === "\\" && quote === '"') {
          if (++i >= source.length) fail("environment_multiline_unsupported");
          const escaped = source[i];
          value += ['"', "\\", "`", "$"].includes(escaped) ? escaped : `\\${escaped}`;
        } else value += char;
      }
      if (!closed) fail("environment_multiline_unsupported");
    } else {
      for (let i = 0; i < source.length; i++) {
        if (source[i] === "\\") {
          if (++i >= source.length) fail("environment_multiline_unsupported");
        }
        value += source[i];
      }
    }
    values.set(key, value);
  }
  return values;
}

export function generatedGoogleSource(clientId, clientSecret) {
  return `/** Generated at build. Do not commit secrets. */\nexport const EMBEDDED_GOOGLE_OAUTH = {\n  clientId: ${JSON.stringify(clientId)},\n  clientSecret: ${JSON.stringify(clientSecret)},\n};\n`;
}

export function parseGeneratedGoogle(bytes) {
  const text = decode(bytes, 16384).replaceAll("\r\n", "\n");
  if (text === NULL_GOOGLE) return null;
  const literal = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/.source;
  const expression = new RegExp('^/\\*\\* Generated at build\\. Do not commit secrets\\. \\*/\\nexport const EMBEDDED_GOOGLE_OAUTH = \\{\\n  clientId: (' + literal + '),\\n  clientSecret: (' + literal + '),\\n\\};\\n$');
  const match = expression.exec(text);
  if (!match) fail("google_generated_format_invalid");
  let clientId, clientSecret;
  try { [clientId, clientSecret] = match.slice(1).map(JSON.parse); }
  catch { fail("google_generated_format_invalid"); }
  scalar(clientId, 1024);
  scalar(clientSecret, 4096);
  if (generatedGoogleSource(clientId, clientSecret) !== text) fail("google_generated_format_invalid");
  return { clientId, clientSecret };
}

export function parseTargetEnvironment(bytes) {
  if (bytes.length > 4096) fail("target_environment_invalid");
  const values = parseEnvironment(bytes);
  if (values.size !== 1 || !values.has("RESCUE_TARGET_DATABASE_URL")) fail("target_environment_invalid");
  const value = values.get("RESCUE_TARGET_DATABASE_URL");
  let url;
  try { url = new URL(value); } catch { fail("target_database_invalid"); }
  const name = url.pathname.slice(1);
  if (!RECOVERY_NAME.test(name) || url.username !== name || !/^[0-9a-f]{64}$/.test(url.password) ||
      value !== `postgresql://${name}:${url.password}@127.0.0.1:5432/${name}`)
    fail("target_database_invalid");
  return value;
}

export function serializeEnvironmentValue(value) {
  scalar(value);
  // Unlike shell quoting, systemd does not expand $ or %. Rejecting controls makes
  // these JSON-style double quotes valid EnvironmentFile syntax.
  return JSON.stringify(value);
}

export function composeCandidate(original, target, signing, googleBytes, random = randomBytes) {
  const values = parseEnvironment(original);
  const database = parseTargetEnvironment(target);
  const secret = decode(signing, 64);
  if (!/^[0-9a-f]{64}$/i.test(secret)) fail("signing_secret_invalid");
  const idPresent = values.has("GOOGLE_CLIENT_ID");
  const secretPresent = values.has("GOOGLE_CLIENT_SECRET");
  if (idPresent !== secretPresent) fail("google_existing_pair_partial");
  const google = idPresent
    ? { clientId: scalar(values.get("GOOGLE_CLIENT_ID"), 1024), clientSecret: scalar(values.get("GOOGLE_CLIENT_SECRET"), 4096) }
    : parseGeneratedGoogle(googleBytes);
  if (!google) fail("google_credentials_missing");
  let reminder = values.get("REMINDER_CRON_SECRET");
  if (values.has("REMINDER_CRON_SECRET")) {
    scalar(reminder);
    if (reminder.length < 32) fail("reminder_secret_invalid");
  } else {
    const entropy = random(32);
    if (!Buffer.isBuffer(entropy) || entropy.length !== 32) fail("random_source_invalid");
    reminder = entropy.toString("hex");
  }
  const required = new Map([
    ["DATABASE_URL", database], ["BETTER_AUTH_SECRET", secret],
    ["GOOGLE_CLIENT_ID", google.clientId], ["GOOGLE_CLIENT_SECRET", google.clientSecret],
    ["REMINDER_CRON_SECRET", reminder], ["BETTER_AUTH_URL", ORIGIN],
  ]);
  const additions = [];
  for (const [key, value] of required) {
    if (values.has(key)) {
      if (values.get(key) !== value) fail("existing_recovery_value_conflict");
    } else additions.push([key, value]);
  }
  const suffix = additions.length ?
    `${original.length && original[original.length - 1] !== 10 ? "\n" : ""}# Recovery candidate; staged only, not activated.\n${additions.map(([key, value]) => `${key}=${serializeEnvironmentValue(value)}`).join("\n")}\n` : "";
  const candidate = Buffer.concat([original, Buffer.from(suffix, "utf8")]);
  const parsed = parseEnvironment(candidate);
  for (const [key, value] of required) if (parsed.get(key) !== value) fail("candidate_roundtrip_failed");
  return { candidate, appendedKeys: additions.map(([key]) => key), googleRecovered: !idPresent, fields: Object.fromEntries(REQUIRED.map((key) => [key, true])) };
}

export function validateOptions(options) {
  if (!BACKUP.test(options.directory ?? "")) fail("backup_directory_invalid");
  for (const [key, basename] of [["targetEnv", "target.env"], ["signingSecret", "auth-signing-secret.txt"]]) {
    const path = options[key];
    if (typeof path !== "string" || !/^\/var\/backups\/white-gloss\/\d{8}T\d{6}Z\//.test(path) ||
        path.split("/").some((part, index) => index && !/^[A-Za-z0-9_.-]+$/.test(part)) ||
        path.split("/").some((part) => part === "." || part === "..") || posix.basename(path) !== basename)
      fail("recovery_input_path_invalid");
  }
  return options;
}

export function parseArguments(args) {
  if (args.length !== 6 || args[0] !== "--directory" || args[2] !== "--target-env" || args[4] !== "--signing-secret")
    fail("arguments_invalid");
  return validateOptions({ directory: args[1], targetEnv: args[3], signingSecret: args[5] });
}

async function inspectDirectories(directory, io, kind) {
  let cursor = "";
  for (const part of directory.split("/").filter(Boolean)) {
    cursor += `/${part}`;
    const stat = await io.lstat(cursor);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o022)) fail("input_directory_unsafe");
    if (kind !== "release" && stat.uid !== 0) fail("input_directory_owner_invalid");
    if (kind === "backup" && cursor.startsWith("/var/backups/white-gloss") && (stat.mode & 0o777) !== 0o700)
      fail("backup_directory_not_private");
  }
}

async function readBounded(path, max, io, kind) {
  await inspectDirectories(posix.dirname(path), io, kind);
  const before = await io.lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > max) fail("input_file_unsafe");
  if (kind !== "release" && (before.uid !== 0 || (before.mode & 0o137))) fail("input_file_not_private");
  if (kind === "release" && (before.mode & 0o022)) fail("input_file_unsafe");
  const handle = await io.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (opened.dev !== before.dev || opened.ino !== before.ino) fail("input_file_changed");
    const bytes = Buffer.alloc(max + 1);
    let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await handle.read(bytes, used, bytes.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    const after = await handle.stat();
    if (used > max || after.size !== before.size || used !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs)
      fail("input_file_changed");
    return bytes.subarray(0, used);
  } finally { await handle.close(); }
}

async function currentRelease(io) {
  const release = await io.realpath(CURRENT);
  if (!/^\/srv\/white-gloss-releases\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(release)) fail("current_release_invalid");
  await inspectDirectories(release, io, "release");
  return release;
}

async function writeExclusive(path, bytes, io) {
  const handle = await io.open(path, "wx", 0o600);
  try {
    await handle.chmod(0o600);
    await handle.writeFile(bytes);
    await handle.sync();
  } finally { await handle.close(); }
}

export async function stageRecoveryEnvironment(options, deps = {}) {
  const io = deps.fs ?? fs;
  try {
    if ((deps.platform ?? process.platform) !== "linux" || (deps.getuid ?? process.getuid)?.() !== 0) fail("linux_root_required");
    validateOptions(options);
    await inspectDirectories(options.directory, io, "backup");
    const candidatePath = `${options.directory}/candidate.environment`;
    const manifestPath = `${options.directory}/candidate.manifest.json`;
    for (const path of [candidatePath, manifestPath]) {
      try { await io.lstat(path); fail("candidate_already_exists"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    const release = await currentRelease(io);
    const original = await readBounded(ORIGINAL, 262144, io, "original");
    const target = await readBounded(options.targetEnv, 4096, io, "backup");
    const signing = await readBounded(options.signingSecret, 64, io, "backup");
    const existing = parseEnvironment(original);
    const needsGoogle = !existing.has("GOOGLE_CLIENT_ID") && !existing.has("GOOGLE_CLIENT_SECRET");
    const googlePath = `${release}${GOOGLE_SUFFIX}`;
    const google = needsGoogle ? await readBounded(googlePath, 16384, io, "release") : undefined;
    const result = composeCandidate(original, target, signing, google, deps.randomBytes ?? randomBytes);
    if (await currentRelease(io) !== release) fail("current_release_changed");
    // Detect changes to the live EnvironmentFile before publishing a candidate.
    if (!original.equals(await readBounded(ORIGINAL, 262144, io, "original"))) fail("original_environment_changed");
    const manifest = {
      version: 1, stagedOnly: true, createdAt: (deps.now ?? (() => new Date()))().toISOString(),
      currentRelease: release,
      integrity: { originalEnvironment: sha(original), candidateEnvironment: sha(result.candidate), ...(google ? { generatedGoogleSource: sha(google) } : {}) },
      fields: result.fields, appendedKeys: result.appendedKeys, googleRecovered: result.googleRecovered,
    };
    await writeExclusive(candidatePath, result.candidate, io);
    await writeExclusive(manifestPath, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), io);
    const directory = await io.open(options.directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await directory.sync(); } finally { await directory.close(); }
    return { ok: true, stagedOnly: true, candidateFile: candidatePath, manifestFile: manifestPath, fields: result.fields, appendedKeys: result.appendedKeys, googleRecovered: result.googleRecovered };
  } catch (error) {
    // Do not expose filesystem diagnostics, parsed lines, values or stack traces.
    // Exclusive partial outputs are retained privately for root review, never retried.
    return { ok: false, code: error instanceof StageError ? error.message : "staging_io_failed", stagedOnly: true };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try { result = await stageRecoveryEnvironment(parseArguments(process.argv.slice(2))); }
  catch (error) { result = { ok: false, code: error instanceof StageError ? error.message : "staging_failed", stagedOnly: true }; }
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
