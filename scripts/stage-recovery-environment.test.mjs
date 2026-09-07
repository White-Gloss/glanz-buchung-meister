import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { constants } from "node:fs";
import { posix } from "node:path";
import {
  composeCandidate, generatedGoogleSource, parseArguments, parseEnvironment,
  parseGeneratedGoogle, parseTargetEnvironment, serializeEnvironmentValue,
  stageRecoveryEnvironment,
} from "./stage-recovery-environment.mjs";

const name = "white_gloss_recovery_test";
const database = `postgresql://${name}:${"a".repeat(64)}@127.0.0.1:5432/${name}`;
const target = Buffer.from(`RESCUE_TARGET_DATABASE_URL=${database}\n`);
const signing = Buffer.from("b".repeat(64));
const google = Buffer.from(generatedGoogleSource("test.apps.googleusercontent.com", 'test-"secret\\$`%value'));
const random = () => Buffer.alloc(32, 0x3c);
const options = {
  directory: "/var/backups/white-gloss/20260907T160000Z",
  targetEnv: "/var/backups/white-gloss/20260907T150000Z/target.env",
  signingSecret: "/var/backups/white-gloss/20260907T140000Z/sealed/auth-signing-secret.txt",
};

test("generated Google parser accepts only the exact JSON-literal generator contract", () => {
  const parsed = parseGeneratedGoogle(google);
  assert.equal(parsed.clientId, "test.apps.googleusercontent.com");
  assert.equal(parsed.clientSecret, 'test-"secret\\$`%value');
  assert.deepEqual(parseGeneratedGoogle(Buffer.from(google.toString().replaceAll("\n", "\r\n"))), parsed);
  for (const source of [
    google.toString() + "globalThis.executed = true;\n",
    google.toString().replace('clientId: "test.apps.googleusercontent.com"', 'clientId: process.env.GOOGLE_CLIENT_ID'),
    google.toString().replace("clientId:", "otherId:"),
    google.toString().replace('"test.apps.googleusercontent.com"', '"\\u0074est.apps.googleusercontent.com"'),
    generatedGoogleSource("", "secret"), generatedGoogleSource("id", "secret\n"),
    generatedGoogleSource("id", "secret\u0000"), "\uFEFF" + google.toString(),
  ]) assert.throws(() => parseGeneratedGoogle(Buffer.from(source)));
  assert.throws(() => parseGeneratedGoogle(Buffer.from([0xff])));
  assert.throws(() => parseGeneratedGoogle(Buffer.alloc(16385)));
  assert.equal(globalThis.executed, undefined);
});

test("EnvironmentFile parser preserves literal shell-like content and systemd escaping", () => {
  const parsed = parseEnvironment(Buffer.from([
    "# preserved comment", "; another comment", "HOST=127.0.0.1", "PORT=3000",
    'MAIL_FROM="White Gloss <test@example.invalid>"',
    "SINGLE='dollar$ percent% back` slash\\ quote\"'",
    'DOUBLE="a\\$b\\`c\\\\d\\\"e\\xf"',
    'UNQUOTED=  literal "quotes"  and\\ spaces  ',
    "SUBSTITUTION=$(touch /never) `never` ${literal}",
    "",
  ].join("\r\n")));
  assert.equal(parsed.get("MAIL_FROM"), "White Gloss <test@example.invalid>");
  assert.equal(parsed.get("SINGLE"), 'dollar$ percent% back` slash\\ quote"');
  assert.equal(parsed.get("DOUBLE"), 'a$b`c\\d"e\\xf');
  assert.equal(parsed.get("UNQUOTED"), 'literal "quotes"  and spaces');
  assert.equal(parsed.get("SUBSTITUTION"), "$(touch /never) `never` ${literal}");
  assert.equal(parseEnvironment(Buffer.from("VALUE= \t\u00a0literal\u00a0\t \n")).get("VALUE"), "\u00a0literal\u00a0");
  assert.throws(() => parseEnvironment(Buffer.from('VALUE="literal"\u00a0\n')));
  for (const value of ['test-"quote\\slash$`%literal', "an apostrophe's value", "üUnicode🙂"]) {
    assert.equal(parseEnvironment(Buffer.from(`VALUE=${serializeEnvironmentValue(value)}\n`)).get("VALUE"), value);
  }
  for (const source of ["export KEY=value", "BARE_LINE", "KEY=one\\\ntwo", 'KEY="unclosed', "KEY='closed'junk", "KEY=\u0000", "KEY=a\rb"]) {
    assert.throws(() => parseEnvironment(Buffer.from(source)));
  }
  assert.throws(() => serializeEnvironmentValue("line\nbreak"));
});

test("duplicate live assignments follow systemd order while retaining every original byte", () => {
  const original = Buffer.from('MAIL_FROM=old@example.invalid\r\nMAIL_FROM="White Gloss <current@example.invalid>"\r\nOPTIONAL=old\r\nOPTIONAL=\r\n');
  const parsed = parseEnvironment(original);
  assert.equal(parsed.get("MAIL_FROM"), "White Gloss <current@example.invalid>");
  assert.equal(parsed.get("OPTIONAL"), "");
  const result = composeCandidate(original, target, signing, google, random);
  assert.ok(result.candidate.subarray(0, original.length).equals(original));
  assert.equal(parseEnvironment(result.candidate).get("MAIL_FROM"), parsed.get("MAIL_FROM"));
  assert.equal(result.appendedKeys.includes("MAIL_FROM"), false);
});

test("the effective last recovery assignment must match and target.env remains duplicate-free", () => {
  for (const [key, expected, conflicting] of [
    ["DATABASE_URL", database, "postgresql://different"],
    ["BETTER_AUTH_SECRET", signing.toString(), "different"],
    ["BETTER_AUTH_URL", "https://white-gloss.de", "http://white-gloss.de"],
  ]) {
    assert.throws(() => composeCandidate(Buffer.from(`${key}=${expected}\n${key}=${conflicting}\n`), target, signing, google, random), /existing_recovery_value_conflict/);
  }
  assert.throws(() => parseTargetEnvironment(Buffer.concat([target, target])), /environment_duplicate_key/);
});

test("candidate keeps original bytes and unknown keys, appending only verified missing fields", () => {
  const original = Buffer.from('# Original\r\nHOST=127.0.0.1\r\nPORT=3000\r\nMAIL_FROM="White Gloss <test@example.invalid>"\r\nQONTO_SECRET_KEY=synthetic-qonto');
  const result = composeCandidate(original, target, signing, google, random);
  assert.ok(result.candidate.subarray(0, original.length).equals(original));
  const values = parseEnvironment(result.candidate);
  assert.equal(values.get("DATABASE_URL"), database);
  assert.equal(values.get("BETTER_AUTH_SECRET"), signing.toString());
  assert.equal(values.get("GOOGLE_CLIENT_SECRET"), parseGeneratedGoogle(google).clientSecret);
  assert.equal(values.get("REMINDER_CRON_SECRET"), "3c".repeat(32));
  assert.equal(values.get("BETTER_AUTH_URL"), "https://white-gloss.de");
  assert.equal(values.get("PORT"), "3000");
  assert.equal(values.get("QONTO_SECRET_KEY"), "synthetic-qonto");
  assert.equal(result.appendedKeys.length, 6);
  assert.equal(result.googleRecovered, true);
  const unchanged = composeCandidate(result.candidate, target, signing, undefined, () => { throw new Error("must not rotate"); });
  assert.ok(unchanged.candidate.equals(result.candidate));
  assert.deepEqual(unchanged.appendedKeys, []);
});

test("existing full Google pair stays intact; partial, empty and conflicting required values fail", () => {
  const full = Buffer.from("GOOGLE_CLIENT_ID=existing-id\nGOOGLE_CLIENT_SECRET=existing-secret\n");
  const result = composeCandidate(full, target, signing, undefined, random);
  assert.equal(parseEnvironment(result.candidate).get("GOOGLE_CLIENT_ID"), "existing-id");
  assert.equal(result.googleRecovered, false);
  for (const original of [
    "GOOGLE_CLIENT_ID=existing-id\n", "GOOGLE_CLIENT_SECRET=existing-secret\n",
    "GOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n", "DATABASE_URL=\n", "DATABASE_URL=postgresql://different\n",
    "GOOGLE_CLIENT_ID=\u00a0existing-id\nGOOGLE_CLIENT_SECRET=existing-secret\n",
    "BETTER_AUTH_SECRET=different\n", "BETTER_AUTH_URL=http://white-gloss.de\n", "REMINDER_CRON_SECRET=short\n",
  ]) assert.throws(() => composeCandidate(Buffer.from(original), target, signing, google, random));
  for (const invalid of [Buffer.from("a".repeat(63)), Buffer.from("g".repeat(64)), Buffer.from("a".repeat(64) + "\n")])
    assert.throws(() => composeCandidate(full, target, invalid, undefined, random));
});

test("target credentials must match the provisioner's explicit local recovery database", () => {
  assert.equal(parseTargetEnvironment(target), database);
  for (const value of [database.replace("127.0.0.1", "example.invalid"), database.replace(":5432", ":6543"),
    database.replace("postgresql:", "postgres:"), database + "?sslmode=disable", database.replaceAll(name, "white_gloss"),
    database.replace(`:${"a".repeat(64)}@`, ":password@"), database + "/other"]) {
    assert.throws(() => parseTargetEnvironment(Buffer.from(`RESCUE_TARGET_DATABASE_URL=${value}\n`)));
  }
  assert.throws(() => parseTargetEnvironment(Buffer.concat([target, Buffer.from("EXTRA=value\n")])));
});

// Virtual Linux filesystem exercises the OS-boundary guards on Windows, while
// recording every open/write and modelling the no-follow and exclusive flags.
function fixture() {
  const entries = new Map();
  let nextIno = 1;
  const log = [];
  function add(path, kind, bytes, uid = 0, mode = 0o700) {
    entries.set(path, { kind, bytes: bytes && Buffer.from(bytes), uid, mode, ino: nextIno++, dev: 1, nlink: 1, mtimeMs: 1, ctimeMs: 1 });
  }
  function dirs(path, privateTree = false) {
    let cursor = "";
    for (const part of path.split("/").filter(Boolean)) {
      cursor += `/${part}`;
      if (!entries.has(cursor)) add(cursor, "directory", undefined, 0, privateTree && cursor.startsWith("/var/backups/white-gloss") ? 0o700 : 0o755);
    }
  }
  for (const path of [options.directory, posix.dirname(options.targetEnv), posix.dirname(options.signingSecret)]) dirs(path, true);
  dirs("/etc/white-gloss");
  const release = "/srv/white-gloss-releases/qonto-409f755";
  dirs(`${release}/src/lib/auth`);
  for (const [path, entry] of entries) if (path.startsWith(release)) entry.uid = 1000;
  add("/etc/white-gloss/environment", "file", "PORT=3000\nHOST=127.0.0.1\n", 0, 0o640);
  add(options.targetEnv, "file", target, 0, 0o600);
  add(options.signingSecret, "file", signing, 0, 0o600);
  add(`${release}/src/lib/auth/google-oauth.generated.ts`, "file", google, 1000, 0o644);
  const missing = () => Object.assign(new Error("synthetic-sensitive-io-detail"), { code: "ENOENT" });
  const stat = (entry) => ({ ...entry, size: entry.bytes?.length ?? 0, isFile: () => entry.kind === "file", isDirectory: () => entry.kind === "directory", isSymbolicLink: () => entry.kind === "symlink" });
  const io = {
    async lstat(path) { if (!entries.has(path)) throw missing(); return stat(entries.get(path)); },
    async realpath(path) { assert.equal(path, "/srv/white-gloss-current"); return release; },
    async open(path, flags, mode) {
      log.push({ path, flags, mode });
      if (flags === "wx") {
        if (entries.has(path)) throw Object.assign(new Error("already exists"), { code: "EEXIST" });
        add(path, "file", Buffer.alloc(0), 0, mode);
      }
      const entry = entries.get(path);
      if (!entry) throw missing();
      if (entry.kind === "symlink") throw new Error("must not follow");
      if (flags !== "wx" && constants.O_NOFOLLOW) assert.ok(flags & constants.O_NOFOLLOW);
      return {
        async stat() { return stat(entry); },
        async read(buffer, offset, length, position) { const count = Math.max(0, Math.min(length, entry.bytes.length - position)); entry.bytes.copy(buffer, offset, position, position + count); return { bytesRead: count }; },
        async chmod(value) { entry.mode = value; },
        async writeFile(bytes) { assert.equal(flags, "wx"); entry.bytes = Buffer.from(bytes); },
        async sync() {}, async close() {},
      };
    },
  };
  return { entries, log, release, deps: { fs: io, platform: "linux", getuid: () => 0, randomBytes: random, now: () => new Date("2026-09-07T16:00:00Z") } };
}

test("staging writes only two exclusive 0600 backup files, with private integrity manifest and safe output", async () => {
  const f = fixture();
  const original = Buffer.from(f.entries.get("/etc/white-gloss/environment").bytes);
  const result = await stageRecoveryEnvironment(options, f.deps);
  assert.equal(result.ok, true, JSON.stringify(result));
  const writes = f.log.filter(({ flags }) => flags === "wx");
  assert.deepEqual(writes.map(({ path }) => path), [`${options.directory}/candidate.environment`, `${options.directory}/candidate.manifest.json`]);
  for (const { path } of writes) assert.equal(f.entries.get(path).mode, 0o600);
  assert.ok(f.entries.get(result.candidateFile).bytes.subarray(0, original.length).equals(original));
  assert.ok(f.entries.get("/etc/white-gloss/environment").bytes.equals(original));
  const manifest = JSON.parse(f.entries.get(result.manifestFile).bytes);
  assert.equal(manifest.currentRelease, f.release);
  assert.equal(manifest.stagedOnly, true);
  assert.match(manifest.integrity.originalEnvironment, /^[a-f0-9]{64}$/);
  for (const output of [JSON.stringify(result), JSON.stringify(manifest)]) {
    assert.ok(!output.includes(database));
    assert.ok(!output.includes(signing.toString()));
    assert.ok(!output.includes(parseGeneratedGoogle(google).clientSecret));
  }
  const before = f.log.length;
  assert.equal((await stageRecoveryEnvironment(options, f.deps)).code, "candidate_already_exists");
  assert.equal(f.log.length, before);
});

test("permissions, symlinks, changed source and malformed credentials abort before candidate writes", async () => {
  const cases = [
    (f) => { f.deps.getuid = () => 1000; },
    (f) => { f.deps.platform = "win32"; },
    (f) => { f.entries.get(options.directory).mode = 0o755; },
    (f) => { f.entries.get(options.directory).uid = 1000; },
    (f) => { f.entries.get(options.targetEnv).kind = "symlink"; },
    (f) => { f.entries.get(posix.dirname(options.signingSecret)).kind = "symlink"; },
    (f) => { f.entries.get(options.targetEnv).nlink = 2; },
    (f) => { f.entries.get(options.targetEnv).bytes = Buffer.alloc(4097); },
    (f) => { f.entries.get(options.signingSecret).uid = 1000; },
    (f) => { f.entries.get("/etc/white-gloss/environment").mode = 0o644; },
    (f) => { f.entries.get(`${f.release}/src/lib/auth/google-oauth.generated.ts`).bytes = Buffer.from("untrusted executable source"); },
    (f) => { let calls = 0; f.deps.fs.realpath = async () => ++calls === 1 ? f.release : "/srv/white-gloss-releases/different"; },
    (f) => {
      const open = f.deps.fs.open;
      let reads = 0;
      f.deps.fs.open = async (path, ...args) => {
        if (path === "/etc/white-gloss/environment" && ++reads === 2)
          f.entries.get(path).bytes = Buffer.from("PORT=4000\n");
        return open(path, ...args);
      };
    },
  ];
  for (const change of cases) {
    const f = fixture(); change(f);
    const result = await stageRecoveryEnvironment(options, f.deps);
    assert.equal(result.ok, false);
    assert.equal(f.log.some(({ flags }) => flags === "wx"), false);
    assert.ok(!JSON.stringify(result).includes("synthetic-sensitive-io-detail"));
  }
});

test("partial output failure is generic, retains only private candidate and never overwrites live configuration", async () => {
  const f = fixture();
  const open = f.deps.fs.open;
  f.deps.fs.open = async (path, ...args) => {
    if (path.endsWith("candidate.manifest.json")) throw new Error("synthetic-sensitive-io-detail");
    return open(path, ...args);
  };
  const result = await stageRecoveryEnvironment(options, f.deps);
  assert.deepEqual(result, { ok: false, code: "staging_io_failed", stagedOnly: true });
  assert.equal(f.entries.get(`${options.directory}/candidate.environment`).mode, 0o600);
  assert.equal(f.entries.has(`${options.directory}/candidate.manifest.json`), false);
  assert.equal(f.entries.get("/etc/white-gloss/environment").bytes.toString(), "PORT=3000\nHOST=127.0.0.1\n");
  assert.equal((await stageRecoveryEnvironment(options, f.deps)).code, "candidate_already_exists");
});

test("CLI is Linux/root-only and accepts no arbitrary code, output path or environment path", () => {
  assert.deepEqual(parseArguments(["--directory", options.directory, "--target-env", options.targetEnv, "--signing-secret", options.signingSecret]), options);
  for (const args of [[], ["--eval", "console.log('secret')"], ["--directory", "/etc/white-gloss", "--target-env", options.targetEnv, "--signing-secret", options.signingSecret],
    ["--directory", options.directory, "--target-env", options.targetEnv.replace("target.env", "../target.env"), "--signing-secret", options.signingSecret]]) assert.throws(() => parseArguments(args));
  const child = spawnSync(process.execPath, [fileURLToPath(new URL("./stage-recovery-environment.mjs", import.meta.url)), "--eval", "never execute"], { encoding: "utf8" });
  assert.equal(child.status, 1);
  assert.deepEqual(JSON.parse(child.stdout), { ok: false, code: "arguments_invalid", stagedOnly: true });
  assert.equal(child.stderr, "");
});
