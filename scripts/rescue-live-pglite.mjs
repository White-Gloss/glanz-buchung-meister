#!/usr/bin/env node
/**
 * Emergency recovery of an EXISTING White Gloss in-memory database. Linux root only.
 * Usage: node scripts/rescue-live-pglite.mjs inspect|backup --pid <MainPID>
 * No service stop/restart, migrations, new database, or provider requests.
 * Before the FINAL backup, block incoming writes and drain existing requests without
 * stopping Node. Preserve the successful tar outside this release before any restart.
 * A timeout does not cancel target-process evaluation; never retry a backup blindly.
 */
import fs from "node:fs";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT = "/srv/white-gloss-current";
const RELEASES = "/srv/white-gloss-releases/";
const PORT = 9229;
const WAIT_MS = 45_000;

export class RescueError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function parseArguments(args) {
  if (args.length !== 3 || !["inspect", "backup"].includes(args[0]) ||
      args[1] !== "--pid" || !/^[1-9][0-9]{0,9}$/.test(args[2])) {
    throw new RescueError("usage: inspect|backup --pid <positive MainPID>");
  }
  const pid = Number(args[2]);
  if (!Number.isSafeInteger(pid) || pid > 2_147_483_647) throw new RescueError("invalid_pid");
  return { mode: args[0], pid };
}

export function validateTarget({ pid, cmdline, executable, current, cwd, status, stat, nodeOptions }) {
  const releaseName = current.startsWith(RELEASES) ? current.slice(RELEASES.length) : "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(releaseName) || cwd !== current) {
    throw new RescueError("unexpected_release_path");
  }
  const argv = cmdline.split("\0").filter(Boolean);
  if (executable !== "/usr/bin/node" || argv.length !== 2 || argv[0] !== "/usr/bin/node" ||
      ![`${CURRENT}/.output/server/index.mjs`, `${current}/.output/server/index.mjs`].includes(argv[1])) {
    throw new RescueError("unexpected_node_command");
  }
  // SIGUSR1 uses the process's existing inspector configuration. Reject overrides.
  if (/--(?:inspect|debug|disable-sigusr1)/.test(nodeOptions)) {
    throw new RescueError("inspector_options_present");
  }
  const uidMatch = /^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/m.exec(status);
  const gidMatch = /^Gid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/m.exec(status);
  if (!uidMatch || !gidMatch || new Set(uidMatch.slice(1)).size !== 1 ||
      new Set(gidMatch.slice(1)).size !== 1 || Number(uidMatch[1]) === 0) {
    throw new RescueError("unexpected_service_identity");
  }
  // /proc/stat field 22, after the possibly spaced comm field.
  const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
  const started = fields[19];
  if (!/^[0-9]+$/.test(started ?? "")) throw new RescueError("invalid_process_identity");
  return { pid, current, uid: Number(uidMatch[1]), gid: Number(gidMatch[1]), started };
}

export function readTarget(pid) {
  const prefix = `/proc/${pid}`;
  const env = fs.readFileSync(`${prefix}/environ`, "utf8").split("\0");
  return validateTarget({
    pid,
    cmdline: fs.readFileSync(`${prefix}/cmdline`, "utf8"),
    executable: fs.readlinkSync(`${prefix}/exe`),
    current: fs.realpathSync(CURRENT),
    cwd: fs.realpathSync(`${prefix}/cwd`),
    status: fs.readFileSync(`${prefix}/status`, "utf8"),
    stat: fs.readFileSync(`${prefix}/stat`, "utf8"),
    nodeOptions: env.find((entry) => entry.startsWith("NODE_OPTIONS="))?.slice(13) ?? "",
  });
}

// Self-contained: serialized into a FIXED inspector expression; never accepts SQL/code.
export async function inspectRuntime(expectedPid) {
  if (process.pid !== expectedPid) throw new Error("target_pid_mismatch");
  const keys = ["DATABASE_URL", "BETTER_AUTH_SECRET", "RESEND_API_KEY", "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_PROVIDER", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_APP_SECRET", "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    "WHATSAPP_API_VERSION", "WHATSAPP_TEMPLATE_NAME", "WHATSAPP_TEMPLATE_LANGUAGE",
    "ADMIN_WHATSAPP_NUMBER", "OWNER_WHATSAPP", "REMINDER_CRON_SECRET"];
  const configuration = Object.fromEntries(keys.map((key) => [key, Boolean(process.env[key]?.trim())]));
  const pending = globalThis.__pgliteInstance__;
  const result = { pid: process.pid, node: process.version, configuration,
    pgliteExists: Boolean(pending), recoveryInProgress: Boolean(globalThis.__whiteGlossRecoveryInProgress__), tables: {} };
  if (!pending) return result;
  const pg = await pending;
  if (!pg || typeof pg.query !== "function") throw new Error("existing_database_unavailable");
  result.capabilities = Object.fromEntries(["dumpDataDir", "runExclusive", "isInTransaction"]
    .map((name) => [name, typeof pg[name] === "function"]));
  const tables = ["_migrations", "user", "session", "account", "verification", "bookings",
    "customers", "inbox_messages", "documents", "cms_items", "outbound_queue", "automation_events",
    "shop_settings", "booking_photos", "booking_events", "whatsapp_webhook_receipts"];
  for (const table of tables) {
    const exists = await pg.query("SELECT to_regclass($1) IS NOT NULL AS present", [`public.${table}`]);
    if (!exists.rows[0]?.present) continue;
    const count = await pg.query(`SELECT count(*)::text AS count FROM public."${table}"`);
    const value = Number(count.rows[0]?.count);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid_count");
    result.tables[table] = value;
  }
  return result;
}

// Only writes the snapshot file in a root-prepared directory under the active release.
export async function backupRuntime(expectedPid, directory) {
  if (process.pid !== expectedPid) throw new Error("target_pid_mismatch");
  if (globalThis.__whiteGlossRecoveryInProgress__) throw new Error("backup_already_in_progress");
  const pending = globalThis.__pgliteInstance__;
  if (!pending) throw new Error("no_existing_pglite");
  const pg = await pending;
  if (!pg || typeof pg.dumpDataDir !== "function" || typeof pg.runExclusive !== "function" ||
      typeof pg.isInTransaction !== "function") throw new Error("unsupported_existing_pglite");
  const fs = process.getBuiltinModule("fs");
  const crypto = process.getBuiltinModule("crypto");
  const cwd = fs.realpathSync(process.cwd());
  if (!directory.startsWith(`${cwd}/.recovery/`) || directory.slice(`${cwd}/.recovery/`.length).includes("/") ||
      fs.realpathSync(directory) !== directory || fs.lstatSync(directory).isSymbolicLink()) {
    throw new Error("unsafe_backup_directory");
  }
  const stat = fs.statSync(directory);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) {
    throw new Error("unsafe_backup_permissions");
  }
  if (globalThis.__whiteGlossRecoveryInProgress__) throw new Error("backup_already_in_progress");
  globalThis.__whiteGlossRecoveryInProgress__ = true;
  try {
    // runExclusive holds the query mutex. Refuse an open transaction between queries.
    // dumpDataDir('none') uses the FS tar writer; it must not execute nested SQL.
    const blob = await pg.runExclusive(async () => {
      if (pg.isInTransaction()) throw new Error("active_transaction_retry_after_drain");
      return pg.dumpDataDir("none");
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length < 1024) throw new Error("invalid_snapshot");
    const path = `${directory}/database.tar`;
    const fd = fs.openSync(path, "wx", 0o600);
    try {
      let offset = 0;
      while (offset < bytes.length) {
        const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
        if (written <= 0) throw new Error("snapshot_write_failed");
        offset += written;
      }
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    const directoryFd = fs.openSync(directory, "r");
    try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
    return { complete: true, path, bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  } finally { delete globalThis.__whiteGlossRecoveryInProgress__; }
}

export function expressionFor(mode, pid, directory) {
  parseArguments([mode, "--pid", String(pid)]);
  if (mode === "inspect") return `(${inspectRuntime.toString()})(${pid})`;
  if (!/^\/srv\/white-gloss-releases\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\/\.recovery\/[0-9TZ-]+-[0-9a-f-]{36}$/.test(directory ?? "")) {
    throw new RescueError("unsafe_backup_directory");
  }
  return `(${backupRuntime.toString()})(${pid},${JSON.stringify(directory)})`;
}

export function prepareDirectory(target) {
  const recovery = `${target.current}/.recovery`;
  try { fs.mkdirSync(recovery, { mode: 0o700 }); fs.chownSync(recovery, target.uid, target.gid); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  const existing = fs.lstatSync(recovery);
  if (!existing.isDirectory() || existing.isSymbolicLink() || existing.uid !== target.uid ||
      (existing.mode & 0o777) !== 0o700 || fs.realpathSync(recovery) !== recovery) {
    throw new RescueError("unsafe_recovery_directory");
  }
  const directory = `${recovery}/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  fs.mkdirSync(directory, { mode: 0o700 });
  fs.chownSync(directory, target.uid, target.gid);
  return directory;
}

export function assertPortFree() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new RescueError("inspector_port_in_use")));
    probe.listen({ host: "127.0.0.1", port: PORT, exclusive: true }, () => probe.close(resolve));
  });
}

export function validateInspectorTarget(list) {
  if (!Array.isArray(list) || list.length !== 1 || list[0]?.type !== "node") throw new RescueError("unexpected_inspector_target");
  const url = list[0].webSocketDebuggerUrl;
  if (typeof url !== "string" || !/^ws:\/\/127\.0\.0\.1:9229\/[0-9a-f-]{36}$/.test(url)) {
    throw new RescueError("non_loopback_inspector");
  }
  return url;
}

async function waitForInspector() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`, { signal: AbortSignal.timeout(500), redirect: "error" });
      if (response.ok) {
        const text = await response.text();
        if (text.length > 16_384) throw new RescueError("unexpected_inspector_response");
        return validateInspectorTarget(JSON.parse(text));
      }
    } catch (error) { if (error instanceof RescueError) throw error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new RescueError("inspector_unavailable_after_signal");
}

export async function connectInspector(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.close(); reject(new RescueError("inspector_connection_timeout")); }, 5_000);
    socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new RescueError("inspector_connection_failed")); }, { once: true });
  });
  let id = 0;
  return {
    socket,
    evaluate(expression, timeoutMs = WAIT_MS) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        const finish = (error, value) => {
          clearTimeout(timeout); socket.removeEventListener("message", receive); socket.removeEventListener("close", closed);
          if (error) reject(error); else resolve(value);
        };
        const closed = () => finish(new RescueError("inspector_disconnected_operation_may_continue"));
        const receive = (event) => {
          let message;
          try { message = JSON.parse(String(event.data)); } catch { return; }
          if (message.id !== requestId) return;
          if (message.error || message.result?.exceptionDetails) {
            const description = message.result?.exceptionDetails?.exception?.description;
            const safeCodes = ["target_pid_mismatch", "no_existing_pglite", "existing_database_unavailable",
              "unsupported_existing_pglite", "backup_already_in_progress", "active_transaction_retry_after_drain",
              "unsafe_backup_directory", "unsafe_backup_permissions", "invalid_snapshot", "snapshot_write_failed"];
            const code = safeCodes.find((candidate) => typeof description === "string" &&
              (description === `Error: ${candidate}` || description.startsWith(`Error: ${candidate}\n`)));
            finish(new RescueError(code ?? "target_evaluation_failed"));
          }
          else finish(null, message.result?.result?.value);
        };
        const timeout = setTimeout(() => finish(new RescueError("target_timeout_operation_may_continue")), timeoutMs);
        socket.addEventListener("message", receive); socket.addEventListener("close", closed, { once: true });
        socket.send(JSON.stringify({ id: requestId, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true, silent: true } }));
      });
    },
  };
}

async function waitForPortClosed() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const closed = await new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port: PORT });
      socket.setTimeout(500);
      socket.once("connect", () => { socket.destroy(); resolve(false); });
      socket.once("error", (error) => { socket.destroy(); resolve(error.code === "ECONNREFUSED"); });
      socket.once("timeout", () => { socket.destroy(); resolve(false); });
    });
    if (closed) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new RescueError("inspector_cleanup_unconfirmed_process_preserved");
}

export async function runRescue(options, deps = {}) {
  const platform = deps.platform ?? process.platform;
  const uid = deps.uid ?? process.getuid?.();
  if (platform !== "linux" || uid !== 0) throw new RescueError("linux_root_required");
  parseArguments([options.mode, "--pid", String(options.pid)]);
  const targetReader = deps.readTarget ?? readTarget;
  const target = targetReader(options.pid);
  await (deps.assertPortFree ?? assertPortFree)();
  const rechecked = targetReader(options.pid);
  if (rechecked.started !== target.started || rechecked.current !== target.current) throw new RescueError("target_changed");
  (deps.signal ?? process.kill)(options.pid, "SIGUSR1");
  let client;
  let verified = false;
  let closeVerified = false;
  let primaryError;
  try {
    const url = await (deps.waitForInspector ?? waitForInspector)();
    client = await (deps.connect ?? connectInspector)(url);
    const pid = await client.evaluate("process.pid", 5_000);
    if (pid !== options.pid) throw new RescueError("target_pid_mismatch");
    verified = true;
    const inspection = await client.evaluate(expressionFor("inspect", options.pid));
    let backup;
    if (options.mode === "backup") {
      if (!inspection?.pgliteExists) throw new RescueError("no_existing_pglite");
      if (inspection.recoveryInProgress) throw new RescueError("backup_already_in_progress");
      const unchanged = targetReader(options.pid);
      if (unchanged.started !== target.started || unchanged.current !== target.current) throw new RescueError("target_changed");
      const directory = (deps.prepareDirectory ?? prepareDirectory)(target);
      backup = await client.evaluate(expressionFor("backup", options.pid, directory));
      if (!backup?.complete || backup.path !== `${directory}/database.tar` ||
          !Number.isSafeInteger(backup.bytes) || backup.bytes < 1024 || !/^[0-9a-f]{64}$/.test(backup.sha256 ?? "")) {
        throw new RescueError("invalid_snapshot_result");
      }
    }
    return { inspection, ...(backup ? { backup } : {}) };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (client && verified) {
      try {
        await client.evaluate("setTimeout(() => process.getBuiltinModule('inspector').close(), 250); true", 5_000);
        client.socket.close();
        await (deps.waitForPortClosed ?? waitForPortClosed)();
        closeVerified = true;
      } catch {
        closeVerified = false;
      } finally { client.socket.close(); }
    } else client?.socket.close();
    if (!closeVerified) {
      // Do not signal an unverified PID again or kill the only database instance.
      const cause = primaryError instanceof RescueError ? `${primaryError.code}; ` : "";
      throw new RescueError(`${cause}inspector_cleanup_unconfirmed_process_preserved`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await runRescue(parseArguments(process.argv.slice(2))))); }
  catch (error) {
    console.error(JSON.stringify({ ok: false, code: error instanceof RescueError ? error.code : "recovery_failed", processPreserved: true }));
    process.exitCode = 1;
  }
}
