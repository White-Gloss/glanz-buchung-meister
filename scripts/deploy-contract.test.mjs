import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { test } from "node:test";
import { BOOKING_CONTRACT, writeDeployContract } from "./write-deploy-contract.mjs";

const migrations = [
  "0007_booking_workflow.sql",
  "0008_notification_delivery.sql",
  "0009_whatsapp_receipts.sql",
];
const NEW_ID = "b".repeat(40);
const OLD_ID = "a".repeat(40);

async function fixture(work) {
  const prefix = resolve(tmpdir(), "white-gloss-deploy-test-");
  const directory = await mkdtemp(prefix);
  try {
    return await work(directory);
  } finally {
    const target = resolve(directory);
    if (dirname(target) !== resolve(tmpdir()) || !target.startsWith(prefix))
      throw new Error("Unsafe test cleanup path");
    await rm(target, { recursive: true, force: true });
  }
}

async function release(directory, id, compatible = true) {
  const output = join(directory, id, ".output");
  await mkdir(join(output, "server"), { recursive: true });
  await writeFile(join(output, "server", "index.mjs"), "// isolated fixture\n");
  if (compatible) await writeDeployContract(output, migrations);
  return output;
}

function findBash() {
  const candidates = [process.env.BASH_BINARY, "bash"];
  if (process.platform === "win32") {
    const found = spawnSync("where.exe", ["git"], { encoding: "utf8" });
    for (const git of (found.stdout || "").trim().split(/\r?\n/).filter(Boolean)) {
      candidates.push(resolve(dirname(git), "../usr/bin/sh.exe"));
      candidates.push(resolve(dirname(git), "../bin/bash.exe"));
    }
  }
  return candidates.filter(Boolean).find((binary) => {
    const result = spawnSync(binary, ["--version"], { encoding: "utf8" });
    return result.status === 0 && /GNU bash/.test(result.stdout);
  });
}
const bash = findBash();
const shellOptions = {
  skip:
    !bash && process.platform === "win32"
      ? "No local Bash; these tests are mandatory in Linux CI"
      : false,
};

async function shell(directory, body, previousId = OLD_ID) {
  assert.ok(bash, "GNU Bash is required for deployment contract tests in CI");
  const helper = join(directory, "helper.sh");
  // Linux checkout uses LF. Normalize only the isolated copy on Windows.
  await writeFile(
    helper,
    (await readFile(new URL("./deploy-ionos-release.sh", import.meta.url), "utf8")).replace(
      /\r\n/g,
      "\n",
    ),
  );
  const syntax = spawnSync(bash, ["-n", helper], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
  const script = `
export PATH="/usr/bin:/bin:$PATH"
source "$TEST_HELPER"
release_path() { printf '%s/%s\\n' "$TEST_ROOT" "$1"; }
current_release_id() { printf '%s\\n' "$OLD_ID"; }
# All privileged or mutable host operations are intercepted. Tests never
# invoke main, access /srv, call a provider, or manipulate a real service.
ln() { printf 'LINK %s\\n' "$2"; }
mv() { :; }
systemctl() { printf 'SERVICE %s\\n' "$1"; }
${body}
`;
  return spawnSync(bash, ["-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      TEST_HELPER: helper.split(sep).join("/"),
      TEST_ROOT: directory.split(sep).join("/"),
      NEW_ID,
      OLD_ID: previousId,
    },
  });
}

test("contract writer requires a completed server entry and the new migration manifest", async () =>
  fixture(async (directory) => {
    await assert.rejects(writeDeployContract(directory, migrations));
    assert.equal(existsSync(join(directory, "booking-workflow.contract")), false);
    await mkdir(join(directory, "server"));
    await writeFile(join(directory, "server", "index.mjs"), "// built server");
    await assert.rejects(writeDeployContract(directory, migrations.slice(1)), /migration manifest/);
    assert.equal(existsSync(join(directory, "booking-workflow.contract")), false);
    await writeDeployContract(directory, migrations);
    assert.equal(
      await readFile(join(directory, "booking-workflow.contract"), "utf8"),
      BOOKING_CONTRACT,
    );
  }));

test("production build writes the contract only after successful build and postprocessing", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(
    pkg.scripts.build,
    /vite build && .*fix-ssr-exports\.mjs && .*copy-pglite-assets\.mjs && node scripts\/write-deploy-contract\.mjs$/,
  );
});

test(
  "helper accepts the writer's marker and refuses missing, malformed and future contracts before activation",
  shellOptions,
  async () =>
    fixture(async (directory) => {
      const output = await release(directory, NEW_ID);
      const accepted = await shell(directory, 'validate_release "$NEW_ID"');
      assert.equal(accepted.status, 0, accepted.stderr);
      for (const marker of ["", "white-gloss-booking-workflow=2\n", `${BOOKING_CONTRACT}extra\n`]) {
        await writeFile(join(output, "booking-workflow.contract"), marker);
        const result = await shell(directory, 'switch_release "$NEW_ID"');
        assert.equal(result.status, 1);
        assert.match(result.stderr, /required booking workflow contract/);
        assert.doesNotMatch(result.stdout, /LINK|SERVICE/);
      }
      await rm(join(output, "booking-workflow.contract"));
      assert.equal((await shell(directory, 'validate_release "$NEW_ID"')).status, 1);
    }),
);

test(
  "failed first cutover never reactivates a legacy release and stops the failing service",
  shellOptions,
  async () =>
    fixture(async (directory) => {
      await release(directory, NEW_ID);
      await release(directory, OLD_ID, false);
      const result = await shell(
        directory,
        'restart_and_wait() { return 1; }; switch_release "$NEW_ID"',
      );
      assert.equal(result.status, 1);
      assert.equal((result.stdout.match(/LINK /g) || []).length, 1);
      assert.ok(!result.stdout.includes(OLD_ID));
      assert.match(result.stdout, /SERVICE stop/);
      assert.match(
        result.stderr,
        /no healthy compatible rollback available; service stopped, database unchanged/,
      );
    }),
);

test("failed new release restores a healthy compatible previous release", shellOptions, async () =>
  fixture(async (directory) => {
    await release(directory, NEW_ID);
    await release(directory, OLD_ID);
    const result = await shell(
      directory,
      'attempt=0; restart_and_wait() { attempt=$((attempt+1)); [[ "$attempt" -eq 2 ]]; }; switch_release "$NEW_ID"',
    );
    assert.equal(
      result.status,
      1,
      "failed deployment still reports failure after successful recovery",
    );
    assert.equal((result.stdout.match(/LINK /g) || []).length, 2);
    assert.ok(result.stdout.includes(OLD_ID));
    assert.doesNotMatch(result.stdout, /SERVICE stop/);
    assert.match(result.stderr, /compatible previous release restored/);
  }),
);

test(
  "failure of both compatible releases stops the service rather than reporting a recovery",
  shellOptions,
  async () =>
    fixture(async (directory) => {
      await release(directory, NEW_ID);
      await release(directory, OLD_ID);
      const result = await shell(
        directory,
        'restart_and_wait() { return 1; }; switch_release "$NEW_ID"',
      );
      assert.equal(result.status, 1);
      assert.match(result.stdout, /SERVICE stop/);
      assert.match(result.stderr, /no healthy compatible rollback/);
    }),
);

test(
  "explicit rollback refuses legacy and missing targets without touching the current service",
  shellOptions,
  async () =>
    fixture(async (directory) => {
      await release(directory, OLD_ID, false);
      for (const target of [OLD_ID, NEW_ID]) {
        const result = await shell(directory, `rollback_release '${target}'`);
        assert.equal(result.status, 1);
        assert.equal(result.stdout.trim(), "");
        assert.match(
          result.stderr,
          /incompatible rollback refused; current release and service unchanged/,
        );
      }
    }),
);

test(
  "successful activation reports a compatible previous SHA and does not stop the service",
  shellOptions,
  async () =>
    fixture(async (directory) => {
      await release(directory, NEW_ID);
      await release(directory, OLD_ID);
      const result = await shell(
        directory,
        'restart_and_wait() { return 0; }; switch_release "$NEW_ID"',
      );
      assert.equal(result.status, 0);
      assert.ok(result.stdout.trim().endsWith(OLD_ID));
      assert.doesNotMatch(result.stdout, /SERVICE stop/);
    }),
);

test(
  "successful cutover from a manually named or incompatible release returns no rollback ID and preserves its files",
  shellOptions,
  async () =>
    fixture(async (directory) => {
      await release(directory, NEW_ID);
      for (const { id, compatible } of [
        { id: OLD_ID, compatible: false },
        { id: "qonto-409f755", compatible: false },
        { id: "qonto-409f755", compatible: true },
      ]) {
        const oldOutput = await release(directory, id, compatible);
        const previousEntry = await readFile(join(oldOutput, "server", "index.mjs"), "utf8");
        const result = await shell(
          directory,
          'restart_and_wait() { return 0; }; switch_release "$NEW_ID"',
          id,
        );
        assert.equal(result.status, 0, result.stderr);
        // LINK lines come only from the test's intercepted ln command.
        assert.equal(result.stdout.replace(/^LINK .*\r?\n/gm, "").trim(), "");
        assert.doesNotMatch(result.stdout, /SERVICE stop/);
        assert.equal(await readFile(join(oldOutput, "server", "index.mjs"), "utf8"), previousEntry);
      }
    }),
);
