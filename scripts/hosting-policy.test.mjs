import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { isIsolatedGithubCi, isActiveIonosRelease } from "./hosting-policy.mjs";
import { guardProductionHosting } from "./guard-production-hosting.mjs";

const root = resolve(import.meta.dirname, "..");
const env = {
  GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "White-Gloss/glanz-buchung-meister",
  GITHUB_WORKFLOW: "CI", GITHUB_RUN_ID: "123", RUNNER_ENVIRONMENT: "self-hosted",
  GITHUB_WORKSPACE: "/ci/white-gloss",
};

test("CI flags never authorize a Windows or macOS website server", () => {
  for (const platform of ["win32", "darwin"]) {
    assert.equal(isIsolatedGithubCi({ platform, env, cwd: env.GITHUB_WORKSPACE, realpath: p => p }), false);
  }
  assert.equal(isIsolatedGithubCi({ platform: "linux", env: { CI: "true", NODE_ENV: "production" } }), false);
});

test("only the existing Linux GitHub CI context and exact workspace permit isolated flows", () => {
  const context = { platform: "linux", env, cwd: env.GITHUB_WORKSPACE, realpath: p => p };
  assert.equal(isIsolatedGithubCi(context), true);
  for (const name of Object.keys(env)) assert.equal(isIsolatedGithubCi({ ...context, env: { ...env, [name]: "" } }), false, name);
  assert.equal(isIsolatedGithubCi({ ...context, env: { ...env, GITHUB_REPOSITORY: "other/repo" } }), false);
  assert.equal(isIsolatedGithubCi({ ...context, cwd: "/some/local/checkout" }), false);
});

test("production requires Linux, the active IONOS release and its working directory", () => {
  const release = `/srv/white-gloss-releases/${"a".repeat(40)}`;
  const entry = pathToFileURL(release + "/.output/server/hosting-policy-entry.mjs").href;
  const realpath = p => p === "/srv/white-gloss-current" ? release : p;
  // Use a POSIX file URL explicitly: this test also runs on Windows.
  const posixEntry = "file://" + release + "/.output/server/hosting-policy-entry.mjs";
  if (process.platform !== "win32") {
    assert.equal(isActiveIonosRelease(posixEntry, { platform: "linux", cwd: release, realpath }), true);
    assert.equal(isActiveIonosRelease(posixEntry, { platform: "linux", cwd: "/tmp/clone", realpath }), false);
    assert.equal(isActiveIonosRelease(posixEntry.replace("a".repeat(40), "b".repeat(40)), { platform: "linux", cwd: release, realpath }), false);
  }
  assert.equal(isActiveIonosRelease(entry, { platform: "win32", cwd: release, realpath }), false);
  assert.equal(isActiveIonosRelease(entry, { platform: "darwin", cwd: release, realpath }), false);
  assert.equal(isActiveIonosRelease(entry, { platform: "linux", realpath: () => { throw Error("missing release"); } }), false);
});

test("blocked entry points exit before opening a socket, even with production/CI flags", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wg-hosting-block-"));
  try {
    const trap = join(dir, "deny-listen.mjs");
    await writeFile(trap, 'import net from "node:net"; net.Server.prototype.listen = function() { throw Error("UNEXPECTED_LISTEN_ATTEMPT"); };');
    const childEnv = { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(trap).href}`, GITHUB_ACTIONS: "", CI: "true", NODE_ENV: "production" };
    const commands = [
      ["scripts/block-local-hosting.mjs"],
      ["scripts/with-app-env.mjs", "vite", "dev"],
      ["scripts/with-app-env.mjs", "vite", "preview"],
      ["scripts/preview.mjs", "restart"],
      ["scripts/qa/isolated-server.mjs"],
      ["scripts/qa/run-checks.mjs"],
      ["node_modules/vite/bin/vite.js", "dev"],
      ["node_modules/vite/bin/vite.js", "preview"],
    ];
    for (const args of commands) {
      const result = spawnSync(process.execPath, args, { cwd: root, env: childEnv, encoding: "utf8", timeout: 20000, windowsHide: true });
      assert.equal(result.error, undefined, args.join(" "));
      assert.notEqual(result.status, 0, args.join(" "));
      assert.match(result.stdout + result.stderr, /WG_LOCAL_HOSTING_BLOCKED/, args.join(" "));
      assert.doesNotMatch(result.stdout + result.stderr, /UNEXPECTED_LISTEN_ATTEMPT/, args.join(" "));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("built entry blocks before evaluating application dependencies; stamping is idempotent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wg-build-hosting-"));
  try {
    const marker = join(dir, "application-executed");
    await writeFile(join(dir, "application.mjs"), `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'bad');`);
    await writeFile(join(dir, "index.mjs"), '#!/usr/bin/env node\nimport "./application.mjs";\n');
    await guardProductionHosting(dir);
    const first = await readFile(join(dir, "index.mjs"), "utf8");
    await guardProductionHosting(dir);
    assert.equal(await readFile(join(dir, "index.mjs"), "utf8"), first);
    const result = spawnSync(process.execPath, [join(dir, "index.mjs")], { cwd: root, env: { ...process.env, GITHUB_ACTIONS: "" }, encoding: "utf8", windowsHide: true });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /WG_LOCAL_HOSTING_BLOCKED/);
    assert.equal(existsSync(marker), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
