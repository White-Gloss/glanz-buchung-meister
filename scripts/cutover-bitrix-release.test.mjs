import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CutoverError,
  MAIN,
  parseArgs,
  runCutover,
  safeFailure,
  sha256,
  strictEnvironment,
  validateEnvironmentPair,
} from "./cutover-bitrix-release.mjs";
import {
  acquireDeployLock,
  COMPATIBLE_MIGRATIONS,
  cronMatches,
  outputDigest,
  protectedAncestor,
  validateMigrationPlan,
  verifyNativeMappings,
  writePrivateVerified,
} from "./cutover-bitrix-runtime.mjs";

test("common deployment lock keeps the descriptor open, closes on contention and never unlinks", async () => {
  for (const fail of [false, true]) {
    let closes = 0;
    const io = {
      async open(path, _flags, mode) {
        assert.equal(path, "/run/white-gloss-deploy.lock");
        assert.equal(mode, 0o600);
        return {
          fd: 42,
          async stat() {
            return { uid: 0, mode: 0o600, isFile: () => true };
          },
          async close() {
            closes++;
          },
        };
      },
    };
    const run = (program, args, options) => {
      assert.equal(program, "/usr/bin/flock");
      assert.deepEqual(args, ["--exclusive", "--nonblock", "3"]);
      assert.equal(options.stdio[3], 42);
      if (fail) throw new Error("private diagnostic");
    };
    if (fail)
      await assert.rejects(acquireDeployLock(undefined, { io, run }), /cutover_lock_unavailable/);
    else {
      const unlock = await acquireDeployLock(undefined, { io, run });
      assert.equal(closes, 0);
      await unlock();
    }
    assert.equal(closes, 1);
  }
});

const previous = "7".repeat(40);
const target = "4".repeat(40);
const secret = "PRIVATE_VALUE_NOT_FOR_OUTPUT";
const baseArgs = [
  `--target-release=${target}`,
  `--target-output-sha256=${"a".repeat(64)}`,
  "--prepared-env=/etc/white-gloss/bitrix.prepared",
];
const oldText = `BOOKING_OPERATIONS=roapp\nDATABASE_URL=postgres://local/${secret}\n`;
const targetText =
  oldText.replace("=roapp", "=bitrix") +
  "BITRIX_WEBHOOK_URL=https://b24-emfor7.bitrix24.de/rest/1/TestCredential123/\n";

function fixture({ failures = {}, changedAt, changedField, unverifiedBackup = false } = {}) {
  const plan = {
    currentRelease: previous,
    targetRelease: target,
    currentOutputHash: "7".repeat(64),
    targetOutputHash: "a".repeat(64),
    oldText,
    targetText,
    openCount: 3,
    pendingMigrations: ["0021_bitrix_native_transfer.sql"],
    dataFingerprint: "inventory",
    writerFingerprint: "units",
    migrationFingerprint: "sql",
    nativeMappingFingerprint: "remote-identities",
    writers: [MAIN, "white-gloss-reminder.timer", "white-gloss-reminder.service"],
    writerStates: {
      [MAIN]: "active",
      "white-gloss-reminder.timer": "active",
      "white-gloss-reminder.service": "inactive",
    },
  };
  const events = [];
  const calls = {};
  let environment = oldText;
  let release = previous;
  let running = true;
  let workers = true;
  function event(name) {
    events.push(name);
    calls[name] = (calls[name] || 0) + 1;
    if (failures[name] === calls[name]) throw new Error(secret);
  }
  const runtime = {
    async readPlan(_options, stopped) {
      event(stopped ? "read:stopped" : "read:running");
      if (stopped) assert.equal(running, false);
      const result = structuredClone(plan);
      if ((stopped ? "stopped" : calls["read:running"]) === changedAt)
        result[changedField] = changedField === "openCount" ? 4 : "CHANGED";
      return result;
    },
    async lock() {
      event("lock");
      return async () => event("unlock");
    },
    checkInterrupted() {
      event("checkpoint");
    },
    async stop() {
      event("stop");
      running = false;
      workers = false;
    },
    async backup() {
      event("backup");
      assert.equal(running || workers, false);
      return { path: "/var/backups/white-gloss/20260925T170000Z", verified: !unverifiedBackup };
    },
    async journal(_backup, phase) {
      event(`journal:${phase}`);
    },
    async migrate() {
      event("migrate");
      assert.equal(running || workers, false);
    },
    async verifySchema(_plan, newer) {
      event(newer ? "schema:target" : "schema:previous");
    },
    async verifyOriginal() {
      event("original");
      assert.equal(environment, oldText);
      assert.equal(release, previous);
    },
    async guardRecovery() {
      event("guard:recovery");
    },
    async swapEnvironment(text) {
      event(text === oldText ? "environment:previous" : "environment:target");
      assert.equal(running || workers, false);
      environment = text;
    },
    async swapRelease(sha) {
      event(sha === previous ? "release:previous" : "release:target");
      assert.equal(running || workers, false);
      release = sha;
    },
    async verifyPair(_plan, newer) {
      event(newer ? "pair:target" : "pair:previous");
      assert.equal(environment, newer ? targetText : oldText);
      assert.equal(release, newer ? target : previous);
    },
    async startMain() {
      event("start:target");
      assert.equal(environment, targetText);
      assert.equal(release, target);
      running = true;
    },
    async health(sha) {
      event(sha === target ? "health:target" : "health:previous");
    },
    async assertWorkersStopped() {
      event("workers:stopped");
      assert.equal(workers, false);
    },
    async startPrevious() {
      event("start:previous");
      assert.equal(environment, oldText);
      assert.equal(release, previous);
      assert.equal(events.at(-2), "pair:previous");
      running = true;
      workers = true;
    },
  };
  return { runtime, events, plan, state: () => ({ environment, release, running, workers }) };
}
const applyOptions = () => parseArgs([...baseArgs, "--apply", "--open-ro=3"]);

test("default is strictly read-only, with no lock, stop, backup or writes", async () => {
  const { runtime, events } = fixture();
  const result = await runCutover(parseArgs(baseArgs), runtime);
  assert.equal(result.ok, true);
  assert.equal(result.readOnly, true);
  assert.deepEqual(events, ["read:running"]);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("apply requires an exact target, reviewed digest, protected env and confirmed count", () => {
  for (const args of [
    [],
    ["--apply"],
    [...baseArgs, "--apply"],
    [...baseArgs, "--open-ro=-1"],
    [...baseArgs, "--open-ro=1.5"],
    [...baseArgs, "--open-ro=9007199254740992"],
    [...baseArgs, "--force"],
    baseArgs.map((a) => (a.startsWith("--target-release") ? "--target-release=main" : a)),
    baseArgs.map((a) =>
      a.startsWith("--prepared-env") ? "--prepared-env=/etc/white-gloss/environment" : a,
    ),
    [...baseArgs, "--target-release=" + target],
    [...baseArgs, "--writer-unit=ssh.service"],
  ])
    assert.throws(() => parseArgs(args), CutoverError);
  assert.equal(applyOptions().apply, true);
});

test("count mismatch or initial inspection failure cannot stop the website", async () => {
  const first = fixture();
  await assert.rejects(
    runCutover({ ...applyOptions(), openCount: 4 }, first.runtime),
    /open_count_not_confirmed/,
  );
  assert.deepEqual(first.events, ["read:running"]);
  const second = fixture({ failures: { "read:running": 1 } });
  await assert.rejects(runCutover(applyOptions(), second.runtime));
  assert.deepEqual(second.events, ["read:running"]);
});

test("lock contention does not stop or alter any service", async () => {
  const f = fixture({ failures: { lock: 1 } });
  await assert.rejects(runCutover(applyOptions(), f.runtime));
  assert.deepEqual(f.events, ["read:running", "lock"]);
  assert.equal(f.state().running, true);
});

test("failure reported after a rename still restores both previous parts", async () => {
  for (const operation of ["swapEnvironment", "swapRelease"]) {
    const f = fixture();
    const original = f.runtime[operation];
    let first = true;
    f.runtime[operation] = async (...args) => {
      await original(...args);
      if (first) {
        first = false;
        throw new Error(secret);
      }
    };
    const result = await runCutover(applyOptions(), f.runtime);
    assert.equal(result.previousPairRestored, true);
    assert.equal(f.state().environment, oldText);
    assert.equal(f.state().release, previous);
  }
});

test("successful cutover verifies backup before SQL, swaps the full pair before start and leaves workers stopped", async () => {
  const f = fixture();
  const result = await runCutover(applyOptions(), f.runtime);
  assert.equal(result.ok, true);
  assert.equal(result.workersStarted, false);
  assert.equal(result.requiresWorkerAcceptance, true);
  assert.deepEqual(f.state(), {
    environment: targetText,
    release: target,
    running: true,
    workers: false,
  });
  const ordered = [
    "lock",
    "stop",
    "read:stopped",
    "backup",
    "migrate",
    "schema:target",
    "environment:target",
    "release:target",
    "pair:target",
    "start:target",
    "health:target",
    "workers:stopped",
    "unlock",
  ];
  let last = -1;
  for (const name of ordered) {
    const next = f.events.indexOf(name);
    assert.ok(next > last, name);
    last = next;
  }
  assert.equal(f.events.includes("start:previous"), false);
});

for (const field of [
  "currentRelease",
  "currentOutputHash",
  "targetOutputHash",
  "oldText",
  "targetText",
  "dataFingerprint",
  "writerFingerprint",
  "migrationFingerprint",
  "nativeMappingFingerprint",
  "openCount",
]) {
  test(`post-stop change to ${field} prevents backup/migration and recovers the original pair`, async () => {
    const f = fixture({ changedAt: "stopped", changedField: field });
    const result = await runCutover(applyOptions(), f.runtime);
    if (field !== "openCount") assert.equal(result.changedField, field);
    assert.equal(result.ok, false);
    assert.equal(result.previousPairRestored, true);
    assert.equal(f.events.includes("backup") || f.events.includes("migrate"), false);
    assert.equal(
      f.events.indexOf("environment:previous") < f.events.indexOf("release:previous"),
      true,
    );
    assert.equal(f.state().environment, oldText);
    assert.equal(f.state().release, previous);
  });
}

test("state change while waiting for lock cannot stop services", async () => {
  const f = fixture({ changedAt: 2, changedField: "dataFingerprint" });
  const result = await runCutover(applyOptions(), f.runtime);
  assert.equal(result.ok, false);
  assert.equal(result.requiresOperator, false);
  assert.equal(f.events.includes("stop"), false);
  assert.equal(f.events.at(-1), "unlock");
});

test("inventory blocker identifies changed tables without rows, secrets or hashes", async () => {
  const f = fixture({ changedAt: "stopped", changedField: "dataFingerprint" });
  const readPlan = f.runtime.readPlan;
  f.runtime.readPlan = async (options, stopped) => {
    const plan = await readPlan(options, stopped);
    plan.tableInventory = {
      bookings: { count: 3, hash: secret },
      bitrix_sync_runner: { count: 1, hash: stopped ? secret + "changed" : secret },
    };
    return plan;
  };
  const result = await runCutover(applyOptions(), f.runtime);
  assert.equal(result.code, "state_changed_before_cutover");
  assert.equal(result.changedField, "dataFingerprint");
  assert.deepEqual(result.changedTables, ["bitrix_sync_runner"]);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(result.previousPairRestored, true);
});

for (const failure of [
  "stop",
  "backup",
  "journal:migration",
  "migrate",
  "schema:target",
  "original",
  "environment:target",
  "release:target",
  "pair:target",
  "start:target",
  "health:target",
  "workers:stopped",
  "journal:healthy_workers_stopped",
]) {
  test(`failure at ${failure} restores both original parts before services; never restores the database`, async () => {
    const f = fixture({ failures: { [failure]: 1 } });
    const result = await runCutover(applyOptions(), f.runtime);
    assert.equal(result.ok, false);
    assert.equal(result.previousPairRestored, true);
    assert.equal(result.databaseRestored, false);
    assert.equal(result.code, "cutover_operation_failed");
    assert.equal(JSON.stringify(result).includes(secret), false);
    const recovery = f.events.slice(f.events.lastIndexOf("stop"));
    assert.ok(recovery.indexOf("environment:previous") < recovery.indexOf("release:previous"));
    assert.ok(recovery.indexOf("pair:previous") < recovery.indexOf("start:previous"));
    assert.deepEqual(f.state(), {
      environment: oldText,
      release: previous,
      running: true,
      workers: true,
    });
    if (["stop", "backup", "journal:migration"].includes(failure))
      assert.equal(f.events.includes("migrate"), false);
  });
}

test("unverified archive prevents migration", async () => {
  const f = fixture({ unverifiedBackup: true });
  const result = await runCutover(applyOptions(), f.runtime);
  assert.equal(result.code, "backup_not_verified");
  assert.equal(f.events.includes("migrate"), false);
});

for (const failure of [
  "schema:previous",
  "guard:recovery",
  "environment:previous",
  "release:previous",
  "pair:previous",
]) {
  test(`recovery failure at ${failure} leaves writers stopped and requires an operator`, async () => {
    const f = fixture({ failures: { "health:target": 1, [failure]: 1 } });
    const result = await runCutover(applyOptions(), f.runtime);
    assert.equal(result.previousPairRestored, false);
    assert.equal(result.requiresOperator, true);
    assert.equal(f.events.includes("start:previous"), false);
    assert.equal(f.state().running || f.state().workers, false);
    assert.equal(JSON.stringify(result).includes(secret), false);
  });
}

test("interrupt before stop is harmless; interrupt after switching recovers the pair", async () => {
  for (const at of [1, 5]) {
    const f = fixture({ failures: { checkpoint: at } });
    const result = await runCutover(applyOptions(), f.runtime);
    assert.equal(result.ok, false);
    if (at === 1) assert.equal(f.events.includes("stop"), false);
    else assert.equal(result.previousPairRestored, true);
  }
});

test("strict environment preserves unrelated values and accepts only this native portal", () => {
  assert.equal(validateEnvironmentPair(oldText, targetText).target.BOOKING_OPERATIONS, "bitrix");
  assert.deepEqual(strictEnvironment("# comment\nA=\"hello there\"\nB='two words'\n"), {
    A: "hello there",
    B: "two words",
  });
  for (const text of ["A=1\nA=2", "A=unclosed'", 'A="bad', "A=a\\b", "export A=1", "A=x\0"])
    assert.throws(() => strictEnvironment(text), CutoverError);
  for (const text of [
    targetText.replace("b24-emfor7", "another"),
    targetText.replace("TestCredential123/", "a/?x=1"),
    targetText.replace(secret, "another_database"),
    targetText + "PUBLIC_ORIGIN=https://another.example\n",
  ])
    assert.throws(() => validateEnvironmentPair(oldText, text), CutoverError);
  assert.equal(safeFailure(new Error(secret)), "cutover_operation_failed");
});

test("only immutable reviewed pending SQL files may run; applied files are not rerun", async () => {
  const entries = {};
  const folder = fileURLToPath(new URL("../migrations/", import.meta.url));
  for (const name of (await fs.readdir(folder)).filter((n) => n.endsWith(".sql")))
    entries[name] = sha256(await fs.readFile(join(folder, name)));
  const applied = Object.keys(entries).filter(
    (name) => !Object.hasOwn(COMPATIBLE_MIGRATIONS, name),
  );
  assert.deepEqual(
    validateMigrationPlan(entries, applied),
    Object.keys(COMPATIBLE_MIGRATIONS).sort(),
  );
  assert.deepEqual(validateMigrationPlan(entries, Object.keys(entries)), []);
  assert.throws(() =>
    validateMigrationPlan({ ...entries, "0021_bitrix_native_transfer.sql": "tampered" }, applied),
  );
  assert.throws(() =>
    validateMigrationPlan(
      entries,
      applied.filter((name) => !name.startsWith("0007")),
    ),
  );
});

test("migration allowlist pins LF source bytes and rejects Windows CRLF variants", async () => {
  for (const [name, expected] of Object.entries(COMPATIBLE_MIGRATIONS)) {
    const bytes = await fs.readFile(new URL(`../migrations/${name}`, import.meta.url));
    assert.equal(
      bytes.includes(Buffer.from([13, 10])),
      false,
      `${name} must use the Git/archive LF bytes`,
    );
    assert.equal(sha256(bytes), expected);
    const changed = sha256(bytes.toString("utf8").replaceAll("\n", "\r\n"));
    assert.notEqual(changed, expected);
    assert.throws(
      () => validateMigrationPlan({ ...COMPATIBLE_MIGRATIONS, [name]: changed }, []),
      /unreviewed_pending_migration/,
    );
  }
});

test("unmanaged cron writers block but comments do not", () => {
  assert.equal(cronMatches("# * * * * * curl localhost:3000/api/automation-cron"), false);
  for (const line of [
    "* * * * * node /ops/run-notifications.mjs",
    "* * * * * /white-gloss/worker",
    "* * * * * curl http://127.0.0.1:3000/api/foo",
  ])
    assert.equal(cronMatches(line), true);
});

test("open native mappings require the exact deal, contact and booking reference", async () => {
  const rows = [{ id: 50, bitrix_deal_id: 600, bitrix_contact_id: 400 }];
  const deal = { ID: "600", CONTACT_ID: "400", UF_CRM_WG_BOOKING_REF: "WG-50" };
  const webhook = "https://b24-emfor7.bitrix24.de/rest/1/TestCredential123/";
  const fetchImpl = (result) => async (url, options) => {
    assert.equal(url, webhook + "crm.deal.get.json");
    assert.equal(options.redirect, "error");
    assert.deepEqual(JSON.parse(options.body), { id: 600 });
    return {
      ok: true,
      async json() {
        return { result };
      },
    };
  };
  const fingerprint = await verifyNativeMappings(webhook, rows, fetchImpl(deal));
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  for (const invalid of [
    { ...deal, ID: "601" },
    { ...deal, CONTACT_ID: "401" },
    { ...deal, UF_CRM_WG_BOOKING_REF: "WG-45" },
    null,
  ])
    await assert.rejects(
      verifyNativeMappings(webhook, rows, fetchImpl(invalid)),
      /native_booking_mapping_mismatch/,
    );
  for (const provider of [
    async () => {
      throw new Error(secret);
    },
    async () => ({ ok: false }),
    async () => ({
      ok: true,
      async json() {
        throw new Error(secret);
      },
    }),
  ])
    await assert.rejects(
      verifyNativeMappings(webhook, rows, provider),
      /native_mapping_probe_failed/,
    );
});

test("only root-owned sticky ancestor may be writable, never the protected leaf", () => {
  const stat = (mode, uid = 0, symlink = false) => ({
    mode,
    uid,
    isDirectory: () => true,
    isSymbolicLink: () => symlink,
  });
  assert.equal(protectedAncestor(stat(0o1777), true), true);
  assert.equal(protectedAncestor(stat(0o1777), false), false);
  assert.equal(protectedAncestor(stat(0o777), true), false);
  assert.equal(protectedAncestor(stat(0o755, 1000), true), false);
  assert.equal(protectedAncestor(stat(0o755, 0, true), true), false);
});

test("output digest is deterministic, content sensitive and rejects embedded environment files", async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), "wg-cutover-output-"));
  try {
    await fs.mkdir(join(dir, "server"));
    await fs.writeFile(join(dir, "server/index.mjs"), "export default 1;");
    const digest = await outputDigest(dir);
    assert.equal(await outputDigest(dir), digest);
    await fs.writeFile(join(dir, "server/index.mjs"), "export default 2;");
    assert.notEqual(await outputDigest(dir), digest);
    await fs.writeFile(join(dir, ".env"), secret);
    await assert.rejects(outputDigest(dir), /output_contains_environment_file/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("private backup writes, fsyncs, closes and verifies exact bytes before acceptance", async () => {
  const events = [];
  const io = {
    async open(path, flags, mode) {
      assert.equal(path, "private-file");
      assert.equal(flags, "wx");
      assert.equal(mode, 0o600);
      return {
        async writeFile(text) {
          assert.equal(text, secret);
          events.push("write");
        },
        async sync() {
          events.push("sync");
        },
        async close() {
          events.push("close");
        },
      };
    },
    async readFile() {
      events.push("read");
      return secret;
    },
  };
  await writePrivateVerified("private-file", secret, io);
  assert.deepEqual(events, ["write", "sync", "close", "read"]);
  await assert.rejects(
    writePrivateVerified("private-file", secret, {
      ...io,
      async readFile() {
        return "truncated";
      },
    }),
    /private_backup_not_verified/,
  );
  await assert.rejects(
    writePrivateVerified("private-file", secret, {
      ...io,
      async open() {
        throw new Error(secret);
      },
    }),
  );
});
