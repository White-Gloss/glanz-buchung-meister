import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import {
  parseArguments,
  validateOptions,
  provisionWithClient,
  runPostgresChild,
  provisionRecovery,
  childProgram,
} from "./provision-recovery-postgres.mjs";

const options = {
  name: "white_gloss_recovery_20260907",
  directory: "/var/backups/white-gloss/20260907T120000Z",
  pgRoot: "/srv/staging/.output/server",
};
const password = "0123456789abcdef".repeat(4);

function databaseFixture(patch = {}) {
  const statements = [];
  let ended = false;
  const client = {
    async connect() {},
    async query(sql, params) {
      statements.push({ sql, params });
      if (sql.startsWith("SELECT current_user"))
        return {
          rows: [
            {
              username: "postgres",
              local_socket: true,
              version: 180000,
              superuser: true,
              ...patch.context,
            },
          ],
        };
      if (sql.startsWith("SELECT EXISTS"))
        return { rows: [{ role_exists: false, database_exists: false, ...patch.existing }] };
      if (sql.startsWith("CREATE DATABASE") && patch.failDatabase)
        throw new Error(`private-error-${password}`);
      if (sql.startsWith("SELECT r.rolcanlogin")) return { rows: [{ valid: true }] };
      return { rows: [] };
    },
    async end() {
      ended = true;
    },
  };
  return { client, statements, ended: () => ended };
}

test("CLI accepts only explicit recovery names, timestamped output and absolute dependency root", () => {
  assert.deepEqual(
    parseArguments([
      "--name",
      options.name,
      "--directory",
      options.directory,
      "--pg-root",
      options.pgRoot,
    ]),
    options,
  );
  for (const patch of [
    { name: "postgres" },
    { name: "white_gloss_recovery_" },
    { name: `${options.name}\";DROP ROLE postgres` },
    { directory: "/tmp/recovery" },
    { directory: `${options.directory}/../outside` },
    { pgRoot: "relative" },
    { pgRoot: "/srv/../root" },
  ])
    assert.throws(() => validateOptions({ ...options, ...patch }));
  assert.throws(() => parseArguments(["--password", password]));
});

test("old PostgreSQL, non-local connections and existing DB or role cause no DDL", async () => {
  for (const patch of [
    { context: { version: 170007 } },
    { context: { local_socket: false } },
    { context: { username: "other" } },
    { context: { superuser: false } },
    { existing: { role_exists: true } },
    { existing: { database_exists: true } },
  ]) {
    const fixture = databaseFixture(patch);
    const result = await provisionWithClient(fixture.client, options.name, password, crypto);
    assert.equal(result.ok, false);
    assert.equal(
      fixture.statements.some(({ sql }) => /^(CREATE|ALTER|DROP)/.test(sql)),
      false,
    );
    assert.equal(fixture.ended(), true);
  }
});

test("creates only a restricted login role and its same-named database without plaintext SQL or outputs", async () => {
  const fixture = databaseFixture();
  const result = await provisionWithClient(fixture.client, options.name, password, crypto);
  assert.deepEqual(result, { ok: true, major: 18, created: { role: true, database: true } });
  const ddl = fixture.statements.filter(({ sql }) => sql.startsWith("CREATE"));
  assert.equal(ddl.length, 2);
  assert.match(
    ddl[0].sql,
    /LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256\$4096:/,
  );
  assert.match(
    ddl[1].sql,
    new RegExp(`CREATE DATABASE "${options.name}" WITH OWNER "${options.name}" TEMPLATE template0`),
  );
  assert.equal(JSON.stringify(fixture.statements).includes(password), false);
  assert.equal(JSON.stringify(result).includes(password), false);
  assert.ok(
    fixture.statements.findIndex(({ sql }) => sql.includes("log_statement")) <
      fixture.statements.findIndex(({ sql }) => sql.startsWith("CREATE")),
  );
  assert.equal(fixture.ended(), true);
});

test("partial provisioning keeps the role and redacts driver failures without dropping resources", async () => {
  const fixture = databaseFixture({ failDatabase: true });
  const result = await provisionWithClient(fixture.client, options.name, password, crypto);
  assert.equal(result.ok, false);
  assert.deepEqual(result.created, { role: true, database: false });
  assert.equal(result.stage, "create_database");
  assert.equal(JSON.stringify(result).includes(password), false);
  assert.equal(
    fixture.statements.some(({ sql }) => /DROP|INSERT|DELETE|UPDATE|TRUNCATE/.test(sql)),
    false,
  );
});

function filesystemFixture({ existing = false, unsafe = false } = {}) {
  let content = "",
    mode,
    synced = false,
    closed = false,
    spawned = false;
  const io = {
    async lstat() {
      return { isDirectory: () => true, isSymbolicLink: () => unsafe, uid: 0, mode: 0o700 };
    },
    async open(path, flag, requestedMode) {
      if (path === options.directory) return { async sync() {}, async close() {} };
      assert.equal(path, `${options.directory}/target.env`);
      assert.equal(flag, "wx");
      assert.equal(requestedMode, 0o600);
      if (existing) throw new Error(`private-existing-${password}`);
      return {
        async chmod(value) {
          mode = value;
        },
        async writeFile(value) {
          content = value;
        },
        async sync() {
          synced = true;
        },
        async close() {
          closed = true;
        },
      };
    },
  };
  const deps = {
    platform: "linux",
    uid: 0,
    io,
    randomBytes: () => Buffer.from(password, "hex"),
    run: async (_options, secret) => {
      assert.equal(synced && closed, true);
      assert.equal(secret, password);
      spawned = true;
      return { ok: true, major: 18 };
    },
  };
  return { deps, state: () => ({ content, mode, synced, closed, spawned }) };
}

test("root persists only a protected RESCUE URL before provisioning and reports no secret", async () => {
  const fixture = filesystemFixture();
  const result = await provisionRecovery(options, fixture.deps);
  assert.deepEqual(result, {
    ok: true,
    major: 18,
    credentialFile: `${options.directory}/target.env`,
  });
  assert.equal(fixture.state().mode, 0o600);
  assert.equal(
    fixture.state().content,
    `RESCUE_TARGET_DATABASE_URL=postgresql://${options.name}:${password}@127.0.0.1:5432/${options.name}\n`,
  );
  assert.equal(JSON.stringify(result).includes(password), false);
  assert.equal(fixture.state().spawned, true);
});

test("existing output, symlinks, non-root and non-Linux execution stop before PostgreSQL", async () => {
  for (const [settings, overrides] of [
    [{ existing: true }, {}],
    [{ unsafe: true }, {}],
    [{}, { uid: 1000 }],
    [{}, { platform: "win32" }],
  ]) {
    const fixture = filesystemFixture(settings);
    const result = await provisionRecovery(options, { ...fixture.deps, ...overrides });
    assert.equal(result.ok, false);
    assert.equal(fixture.state().spawned, false);
    assert.equal(JSON.stringify(result).includes(password), false);
  }
});

test("runuser gets fixed arguments and an isolated password environment; stdout/stderr extras are discarded", async () => {
  const spawnProcess = (command, args, spawnOptions) => {
    assert.equal(command, "/usr/sbin/runuser");
    assert.deepEqual(args, ["-u", "postgres", "--", "/usr/bin/node", "--input-type=module", "-"]);
    assert.equal(args.join(" ").includes(password), false);
    assert.equal(spawnOptions.env.RESCUE_DB_PASSWORD, password);
    assert.deepEqual(Object.keys(spawnOptions.env).sort(), [
      "LANG",
      "PATH",
      "RESCUE_DB_NAME",
      "RESCUE_DB_PASSWORD",
      "RESCUE_PG_ROOT",
    ]);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.kill = () => {};
    child.stdin.end = (program) => {
      assert.equal(program.includes(password), false);
      assert.match(
        program,
        /host:'\/var\/run\/postgresql',port:5432,user:'postgres',database:'postgres'/,
      );
      assert.match(program, /statement_timeout:10000,lock_timeout:3000,query_timeout:12000/);
      queueMicrotask(() => {
        child.stderr.emit("data", Buffer.from(password));
        child.stdout.emit(
          "data",
          JSON.stringify({
            ok: true,
            major: 18,
            created: { role: true, database: true },
            unexpected: password,
          }),
        );
        child.emit("close", 0);
      });
    };
    return child;
  };
  assert.deepEqual(await runPostgresChild(options, password, spawnProcess), {
    ok: true,
    major: 18,
  });
  assert.equal(childProgram().includes(password), false);
});
