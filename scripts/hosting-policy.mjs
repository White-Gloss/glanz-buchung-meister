import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HOSTING_BLOCK_MESSAGE =
  "WG_LOCAL_HOSTING_BLOCKED: Lokales Hosting ist vom Betreiber gesperrt. " +
  "White-Gloss ausschließlich über den freigegebenen IONOS-Weg betreiben. " +
  "Build, Lint und Typprüfung starten keinen Webserver und bleiben erlaubt.";

export function blockLocalHosting() {
  throw new Error(HOSTING_BLOCK_MESSAGE);
}

// No local override switch. CI=true and a production NODE_ENV do not authorize hosting.
// Only the existing Linux GitHub CI job may run its isolated, synthetic flow tests.
export function isIsolatedGithubCi({
  platform = process.platform,
  env = process.env,
  cwd = process.cwd(),
  realpath = realpathSync,
} = {}) {
  if (platform !== "linux" || env.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_REPOSITORY !== "White-Gloss/glanz-buchung-meister" ||
      env.GITHUB_WORKFLOW !== "CI" || !/^\d+$/.test(env.GITHUB_RUN_ID || "") ||
      !["github-hosted", "self-hosted"].includes(env.RUNNER_ENVIRONMENT) ||
      !env.GITHUB_WORKSPACE) return false;
  try {
    return realpath(cwd) === realpath(env.GITHUB_WORKSPACE);
  } catch {
    return false;
  }
}

export function assertIsolatedGithubCi() {
  if (!isIsolatedGithubCi()) blockLocalHosting();
}

export function isActiveIonosRelease(entryUrl, {
  platform = process.platform,
  cwd = process.cwd(),
  realpath = realpathSync,
} = {}) {
  if (platform !== "linux") return false;
  try {
    const server = realpath(dirname(fileURLToPath(entryUrl)));
    const active = realpath("/srv/white-gloss-current");
    return /^\/srv\/white-gloss-releases\/[0-9a-f]{40}$/.test(active) &&
      realpath(cwd) === active && server === resolve(active, ".output/server");
  } catch {
    return false;
  }
}

export function assertProductionHosting(entryUrl) {
  if (!isIsolatedGithubCi() && !isActiveIonosRelease(entryUrl)) blockLocalHosting();
}
