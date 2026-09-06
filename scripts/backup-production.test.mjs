import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import {
  backupProduction,
  postgresEnvironment,
  runBackupTool,
  validBackupPath,
} from "./backup-production.mjs";

const output = "/var/backups/white-gloss/20260907T120000Z/database.dump";
const database =
  "postgresql://private-user:private%40password@db.example.invalid/app?sslmode=require&channel_binding=require";
const payload = Buffer.from("PGDMP-isolated-fixture");
function fixture({ existing = false, unsafeDirectory = false } = {}) {
  let closed = false;
  let opened = false;
  const io = {
    async lstat() {
      return {
        isDirectory: () => true,
        isSymbolicLink: () => unsafeDirectory,
        uid: 0,
        mode: 0o700,
      };
    },
    async mkdir() {
      throw new Error("fixture directory exists");
    },
    async open(path, flag, mode) {
      assert.equal(path, output);
      assert.equal(flag, "wx+");
      assert.equal(mode, 0o600);
      if (existing) throw Object.assign(new Error("private-existing-file"), { code: "EEXIST" });
      opened = true;
      return {
        fd: 51,
        async sync() {},
        async stat() {
          return { isFile: () => true, size: payload.length, mode: 0o600 };
        },
        async *createReadStream() {
          yield payload;
        },
        async close() {
          closed = true;
        },
      };
    },
  };
  return { io, closed: () => closed, opened: () => opened };
}

test("only explicit timestamped paths inside approved backup locations are accepted", () => {
  assert.equal(validBackupPath(output), true);
  assert.equal(validBackupPath("/root/wg-backup-20260907T120000Z/database.dump"), true);
  for (const path of [
    "",
    "/root/database.dump",
    "/tmp/database.dump",
    "/var/backups/white-gloss/../database.dump",
    `${output}/other`,
    "/var/backups/white-gloss/20260907T120000Z/link.dump",
  ])
    assert.equal(validBackupPath(path), false, path);
});

test("connection values are decoded into child PG environment and unsupported URI options fail closed", () => {
  const env = postgresEnvironment(database);
  assert.equal(env.PGDATABASE, "app");
  assert.equal(env.PGUSER, "private-user");
  assert.equal(env.PGPASSWORD, "private@password");
  assert.equal(env.PGHOST, "db.example.invalid");
  assert.equal(env.PGSSLMODE, "require");
  assert.equal(env.PGCHANNELBINDING, "require");
  assert.equal(env.DATABASE_URL, undefined);
  for (const url of [
    undefined,
    "private-invalid",
    "https://private:secret@host/app",
    `${database}&private_option=private-value`,
    `${database}&sslmode=disable`,
    "postgres://user:password@host/db%00secret",
  ])
    assert.throws(
      () => postgresEnvironment(url),
      (error) => error.message === "database_configuration_invalid_or_unsupported_option",
    );
});

test("backup reserves a private file, sends no credentials in argv, checks only archive list, then hashes", async () => {
  const f = fixture();
  const calls = [];
  const run = async (command, args, options) => {
    calls.push({ command, args, options });
    assert.ok(options.timeoutMs > 0 && options.timeoutMs <= 120_000);
    assert.doesNotMatch(JSON.stringify(args), /private-|postgres:/);
    return { warnings: false };
  };
  const result = await backupProduction(output, {
    env: { DATABASE_URL: database, RESEND_API_KEY: "private-unrelated-key" },
    io: f.io,
    run,
    uid: 0,
  });
  assert.equal(calls[0].command, "/usr/bin/pg_dump");
  assert.deepEqual(calls[0].args, ["-Fc", "--no-password", "--lock-wait-timeout=10000"]);
  assert.equal(calls[0].options.stdout, 51);
  assert.equal(calls[0].options.env.PGPASSWORD, "private@password");
  assert.equal(calls[0].options.env.RESEND_API_KEY, undefined);
  assert.equal(calls[1].command, "/usr/bin/pg_restore");
  assert.deepEqual(calls[1].args, ["--list", output]);
  assert.equal(calls[1].options.env.PGDATABASE, undefined);
  assert.equal(result.sha256, createHash("sha256").update(payload).digest("hex"));
  assert.equal(result.bytes, payload.length);
  assert.equal(result.archiveListValid, true);
  assert.equal(f.closed(), true);
  assert.doesNotMatch(JSON.stringify(result), /PGDMP|private-|password/);
});

test("existing files, unsafe directories and non-root execution prevent all child processes", async () => {
  for (const settings of [{ existing: true }, { unsafeDirectory: true }, { uid: 1000 }]) {
    const f = fixture(settings);
    let calls = 0;
    await assert.rejects(
      backupProduction(output, {
        env: { DATABASE_URL: database },
        io: f.io,
        uid: settings.uid ?? 0,
        run: async () => {
          calls++;
          return { warnings: false };
        },
      }),
    );
    assert.equal(calls, 0);
  }
});

test("dump or archive-list failure never returns a successful checksum and closes the partial backup", async () => {
  for (const failingCall of [1, 2]) {
    const f = fixture();
    let calls = 0;
    await assert.rejects(
      backupProduction(output, {
        env: { DATABASE_URL: database },
        io: f.io,
        uid: 0,
        run: async () => {
          if (++calls === failingCall) throw new Error("fixture child failed");
          return { warnings: false };
        },
      }),
      /fixture child failed/,
    );
    assert.equal(f.closed(), true);
    assert.equal(calls, failingCall);
  }
});

test("fake child stderr is drained but never surfaced; timeout kills the child and returns a safe code", async () => {
  let killed = false;
  let child;
  const spawn = (command, args, options) => {
    assert.equal(options.shell, false);
    child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = (signal) => {
      assert.equal(signal, "SIGKILL");
      killed = true;
      return true;
    };
    queueMicrotask(() =>
      child.stderr.emit("data", "private-user private-password private-customer"),
    );
    return child;
  };
  await assert.rejects(
    runBackupTool("fake", [], { env: {}, timeoutMs: 5 }, spawn),
    (error) => error.message === "backup_timeout",
  );
  assert.equal(killed, true);
  child.emit("close", null);
});

test("fake child success records warnings without returning their content", async () => {
  const spawn = () => {
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => true;
    queueMicrotask(() => {
      child.stderr.emit("data", "private diagnostic");
      child.emit("close", 0);
    });
    return child;
  };
  assert.deepEqual(await runBackupTool("fake", [], { env: {}, timeoutMs: 1000 }, spawn), {
    warnings: true,
  });
});
