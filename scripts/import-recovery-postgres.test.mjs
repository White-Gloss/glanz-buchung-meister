import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
  parseArguments,
  validateOptions,
  psqlInvocation,
  runPsql,
  importRecovery,
} from "./import-recovery-postgres.mjs";

const options = {
  bundle: "/var/backups/white-gloss/20260906T234316Z/export-initial",
  expectedDatabase: "white_gloss_recovery_20260907",
  targetEnv: "/var/backups/white-gloss/20260907T020000Z/target.env",
  pgRoot: "/srv/wg-release",
};
const password = "abc01234".repeat(8);
const connection = `postgresql://${options.expectedDatabase}:${password}@127.0.0.1:5432/${options.expectedDatabase}`;
const environment = Buffer.from(`RESCUE_TARGET_DATABASE_URL=${connection}\n`);

function fixture(patch = {}) {
  const events = [];
  const bytes = patch.environment ?? environment;
  const fileStat = {
    isFile: () => true,
    isSymbolicLink: () => false,
    nlink: 1,
    uid: 0,
    mode: 0o600,
    size: bytes.length,
    dev: 1,
    ino: 42,
    mtimeMs: 1,
    ctimeMs: 1,
  };
  const io = {
    async lstat(path) {
      if (/\.(env|json|sql)$/.test(path))
        return { ...fileStat, ...(path === options.targetEnv ? patch.file : {}) };
      return {
        isDirectory: () => true,
        isSymbolicLink: () => false,
        uid: 0,
        mode: 0o700,
        ...patch.directory,
      };
    },
    async open(path, flags, mode) {
      if (path === options.targetEnv) {
        assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW);
        return {
          async stat() {
            return { ...fileStat, ...patch.openedFile };
          },
          async read(buffer, offset, length, position) {
            const count = Math.min(length, bytes.length - position);
            if (count > 0) bytes.copy(buffer, offset, position, position + count);
            return { bytesRead: Math.max(0, count) };
          },
          async close() {},
        };
      }
      if (path === options.bundle)
        return {
          async sync() {
            events.push("directory_synced");
          },
          async close() {},
        };
      assert.equal(path, `${options.bundle}/import-postgres.log`);
      assert.equal(flags, "wx");
      assert.equal(mode, 0o600);
      if (patch.existingLog) throw new Error(`private-existing-${password}`);
      events.push("log_created");
      return {
        fd: 73,
        async chmod(value) {
          assert.equal(value, 0o600);
        },
        async sync() {
          events.push("log_synced");
        },
        async close() {
          events.push("log_closed");
        },
      };
    },
  };
  const deps = {
    platform: "linux",
    uid: 0,
    io,
    async readBundle(path) {
      assert.equal(path, options.bundle);
      events.push("bundle_checked");
      if (patch.badBundle) throw new Error(`private-manifest-${password}`);
      return { inventory: { major: 18 } };
    },
    createPool(root, url) {
      assert.equal(root, options.pgRoot);
      assert.equal(url, connection);
      events.push("pool_created");
      return {
        async end() {
          events.push("pool_ended");
        },
      };
    },
    async verifyTarget(_pool, _manifest, database, mode) {
      assert.equal(database, options.expectedDatabase);
      events.push(mode);
      if (patch.failStage === mode) throw new Error(`private-sql-customer-row-${password}`);
      return mode === "check-target"
        ? { ok: true, empty: true, targetVersion: patch.version ?? 180006 }
        : { ok: true, matched: true, tables: 2, rows: 4, sequences: 1 };
    },
    async runPsql(invocation) {
      events.push("psql");
      assert.deepEqual(
        invocation,
        psqlInvocation(connection, options.expectedDatabase, `${options.bundle}/database.sql`, 73),
      );
      assert.ok(events.indexOf("check-target") < events.indexOf("log_created"));
      assert.ok(events.indexOf("directory_synced") < events.indexOf("psql"));
      return { ok: !patch.failImport };
    },
  };
  return { deps, events };
}

test("CLI rejects implicit/live targets, traversals and credential arguments", () => {
  assert.deepEqual(
    parseArguments([
      "--bundle",
      options.bundle,
      "--expected-database",
      options.expectedDatabase,
      "--target-env",
      options.targetEnv,
      "--pg-root",
      options.pgRoot,
    ]),
    options,
  );
  for (const patch of [
    { expectedDatabase: "postgres" },
    { expectedDatabase: "white_gloss" },
    { targetEnv: "/etc/white-gloss/environment" },
    { targetEnv: "/tmp/target.env" },
    { bundle: "/tmp/backup" },
    { bundle: `${options.bundle}/../elsewhere` },
    { bundle: `${options.bundle}/` },
    { pgRoot: "relative" },
  ])
    assert.throws(() => validateOptions({ ...options, ...patch }));
  assert.throws(() => parseArguments(["--database-url", connection]));
});

test("psql uses only explicit PG environment credentials and sends both outputs to the private descriptor", () => {
  const invocation = psqlInvocation(
    connection,
    options.expectedDatabase,
    `${options.bundle}/database.sql`,
    73,
  );
  assert.equal(invocation.command, "/usr/lib/postgresql/18/bin/psql");
  assert.deepEqual(invocation.args, [
    "-X",
    "--no-password",
    "--single-transaction",
    "--set",
    "ON_ERROR_STOP=1",
    "--file",
    `${options.bundle}/database.sql`,
  ]);
  assert.equal(invocation.args.join(" ").includes(password), false);
  assert.equal(invocation.args.join(" ").includes("postgresql://"), false);
  assert.deepEqual(invocation.options.stdio, ["ignore", 73, 73]);
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.env.PGPASSWORD, password);
  assert.deepEqual(Object.keys(invocation.options.env).sort(), [
    "LANG",
    "PATH",
    "PGAPPNAME",
    "PGCONNECT_TIMEOUT",
    "PGDATABASE",
    "PGHOST",
    "PGPASSWORD",
    "PGPORT",
    "PGSSLMODE",
    "PGUSER",
  ]);
  for (const url of [
    connection.replace("127.0.0.1", "example.com"),
    connection.replace(options.expectedDatabase, "postgres"),
    `${connection}?options=-csearch_path=other`,
  ])
    assert.throws(() => psqlInvocation(url, options.expectedDatabase, "database.sql", 73));
  assert.throws(() => psqlInvocation(connection, "white_gloss_recovery_other", "database.sql", 73));
});

test("successful import checks the bundle and empty target first, then verifies the restored data exactly once", async () => {
  const { deps, events } = fixture();
  const result = await importRecovery(options, deps);
  assert.deepEqual(result, {
    ok: true,
    verified: true,
    logFile: `${options.bundle}/import-postgres.log`,
    database: options.expectedDatabase,
    tables: 2,
    rows: 4,
    sequences: 1,
  });
  assert.deepEqual(
    events.filter((event) => ["bundle_checked", "check-target", "psql", "verify"].includes(event)),
    ["bundle_checked", "check-target", "psql", "verify"],
  );
  assert.ok(events.includes("log_closed"));
  assert.ok(events.includes("pool_ended"));
  assert.equal(JSON.stringify(result).includes(password), false);
});

test("modified bundles, existing objects or old PG prevent any import and redact database diagnostics", async () => {
  for (const patch of [{ badBundle: true }, { failStage: "check-target" }, { version: 170007 }]) {
    const { deps, events } = fixture(patch);
    const result = await importRecovery(options, deps);
    assert.equal(result.ok, false);
    assert.equal(events.includes("psql"), false);
    assert.equal(events.includes("log_created"), false);
    assert.equal(JSON.stringify(result).includes(password), false);
    assert.equal(JSON.stringify(result).includes("customer-row"), false);
  }
});

test("a previous import log prohibits another psql attempt without replacing that log", async () => {
  const { deps, events } = fixture({ existingLog: true });
  const result = await importRecovery(options, deps);
  assert.equal(result.ok, false);
  assert.equal(result.stage, "prepare_log");
  assert.equal(events.includes("psql"), false);
  assert.equal(events.includes("log_created"), false);
  assert.ok(events.includes("pool_ended"));
});

test("failed native import preserves its log and never proceeds to verification or repeats psql", async () => {
  const { deps, events } = fixture({ failImport: true });
  const result = await importRecovery(options, deps);
  assert.equal(result.ok, false);
  assert.equal(result.stage, "import");
  assert.equal(result.logFile, `${options.bundle}/import-postgres.log`);
  assert.equal(events.filter((event) => event === "psql").length, 1);
  assert.equal(events.includes("verify"), false);
  assert.ok(events.includes("log_closed") && events.includes("pool_ended"));
});

test("post-import verification failure reports no success, retains the target, and redacts row data", async () => {
  const { deps, events } = fixture({ failStage: "verify" });
  const result = await importRecovery(options, deps);
  assert.equal(result.ok, false);
  assert.equal(result.stage, "verify");
  assert.equal(result.logFile, `${options.bundle}/import-postgres.log`);
  assert.equal(events.filter((event) => event === "psql").length, 1);
  assert.equal(JSON.stringify(result).includes(password), false);
  assert.equal(JSON.stringify(result).includes("customer-row"), false);
  assert.ok(events.includes("log_closed") && events.includes("pool_ended"));
});

test("non-root, symlinks, hardlinks, unsafe permissions and file replacement fail before database access", async () => {
  for (const [patch, overrides] of [
    [{}, { uid: 1000 }],
    [{}, { platform: "win32" }],
    [{ directory: { isSymbolicLink: () => true } }, {}],
    [{ directory: { uid: 1000 } }, {}],
    [{ directory: { mode: 0o755 } }, {}],
    [{ file: { isSymbolicLink: () => true } }, {}],
    [{ file: { nlink: 2 } }, {}],
    [{ file: { mode: 0o644 } }, {}],
    [{ file: { uid: 1000 } }, {}],
    [{ openedFile: { ino: 43 } }, {}],
    [{ openedFile: { mtimeMs: 2 } }, {}],
  ]) {
    const { deps, events } = fixture(patch);
    const result = await importRecovery(options, { ...deps, ...overrides });
    assert.equal(result.ok, false);
    assert.equal(events.includes("pool_created"), false);
    assert.equal(events.includes("psql"), false);
  }
});

test("target.env accepts only the provisioned recovery assignment without shell evaluation or live fallback", async () => {
  for (const text of [
    `DATABASE_URL=${connection}\n`,
    `${environment}PGHOST=example.com\n`,
    `${environment}${environment}`,
    `RESCUE_TARGET_DATABASE_URL=$(echo ${connection})\n`,
    environment.toString().replace("127.0.0.1", "example.com"),
    environment.toString().replace(password, "short-password"),
  ]) {
    const { deps, events } = fixture({ environment: Buffer.from(text) });
    const result = await importRecovery(options, deps);
    assert.equal(result.ok, false);
    assert.equal(events.includes("pool_created"), false);
    assert.equal(JSON.stringify(result).includes(password), false);
  }
});

test("child exit errors are sanitized and never retried", async () => {
  let calls = 0;
  const result = await runPsql(
    psqlInvocation(connection, options.expectedDatabase, "database.sql", 73),
    () => {
      calls++;
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("error", new Error(`private-${password}`)));
      return child;
    },
  );
  assert.deepEqual(result, { ok: false });
  assert.equal(calls, 1);
});

test("child stdout and stderr stay in the opened log even when psql fails", async () => {
  const directory = await fs.mkdtemp(join(tmpdir(), "wg-import-log-test-"));
  const file = join(directory, "import-postgres.log");
  const handle = await fs.open(file, "wx", 0o600);
  try {
    const result = await runPsql(
      psqlInvocation(connection, options.expectedDatabase, "database.sql", handle.fd),
      (_command, _args, settings) =>
        spawn(
          process.execPath,
          [
            "-e",
            "process.stdout.write('private-row-stdout');process.stderr.write('private-row-stderr');process.exitCode=1",
          ],
          settings,
        ),
    );
    await handle.sync();
    assert.deepEqual(result, { ok: false });
    const text = await fs.readFile(file, "utf8");
    assert.ok(text.includes("private-row-stdout") && text.includes("private-row-stderr"));
    assert.equal(JSON.stringify(result).includes("private-row"), false);
    if (process.platform !== "win32") assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  } finally {
    await handle.close();
    await fs.unlink(file);
    await fs.rmdir(directory);
  }
});
