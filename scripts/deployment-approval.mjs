import { pathToFileURL } from "node:url";

const shaPattern = /^[0-9a-f]{40}$/;
const requiredJobs = ["verify", "schema", "studio", "cross-browser"];

// Read-only gate. A manual dispatch approves one commit and one expected
// production predecessor, never whichever revision happens to exist later.
export async function verifyDeploymentApproval(env, request) {
  const release = env.RELEASE_ID;
  const expectedCurrent = env.EXPECTED_CURRENT_RELEASE;
  if (env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_REF !== "refs/heads/main") {
    throw new Error("Production requires a manual dispatch from main.");
  }
  if (!shaPattern.test(release ?? "") || !shaPattern.test(expectedCurrent ?? "") ||
      release === expectedCurrent || release !== env.GITHUB_SHA) {
    throw new Error("Explicit release and expected current commit must be distinct full SHAs; release must equal the dispatched main commit.");
  }
  const repository = env.GITHUB_REPOSITORY;
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository ?? "")) {
    throw new Error("Invalid repository context.");
  }
  const prefix = `repos/${repository}`;
  const main = await request(`${prefix}/git/ref/heads/main`);
  if (main.object?.sha !== release) {
    throw new Error("main changed since approval; dispatch the intended current commit again.");
  }
  const response = await request(
    `${prefix}/actions/workflows/ci.yml/runs?branch=main&event=push&head_sha=${release}&per_page=100`,
  );
  // Do not filter by completion: a newer queued/running/failed run invalidates
  // an older green result. GitHub returns the current attempt on each run.
  const runs = [...(response.workflow_runs ?? [])].sort((left, right) => right.id - left.id);
  const run = runs[0];
  if (!run || !Number.isSafeInteger(run.id) || run.id < 1 ||
      !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 ||
      run.head_sha !== release || run.head_branch !== "main" ||
      run.head_repository?.full_name !== repository || run.event !== "push" ||
      run.path !== ".github/workflows/ci.yml" ||
      run.status !== "completed" || run.conclusion !== "success") {
    throw new Error("The latest CI run for the approved main commit is missing or not successful.");
  }
  const jobs = [];
  let total;
  for (let page = 1; page <= 10; page += 1) {
    const result = await request(
      `${prefix}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`,
    );
    if (!Array.isArray(result.jobs) || !Number.isSafeInteger(result.total_count)) {
      throw new Error("CI job evidence is incomplete.");
    }
    jobs.push(...result.jobs);
    total = result.total_count;
    if (jobs.length >= total) break;
  }
  if (jobs.length !== total) throw new Error("CI job evidence is incomplete.");
  for (const name of requiredJobs) {
    const matches = jobs.filter((job) => job.name === name);
    if (matches.length !== 1 || matches[0].head_sha !== release ||
        matches[0].status !== "completed" || matches[0].conclusion !== "success") {
      throw new Error(`Required CI job is missing or unsuccessful: ${name}.`);
    }
  }
  return { release, expectedCurrent, ciRun: run.id, ciAttempt: run.run_attempt };
}

async function githubRequest(path) {
  if (!process.env.GH_TOKEN) throw new Error("GitHub read token is missing.");
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub approval check failed (HTTP ${response.status}).`);
  return response.json();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyDeploymentApproval(process.env, githubRequest);
    console.log(`Approved commit ${result.release}; CI ${result.ciRun}, attempt ${result.ciAttempt}; expected production ${result.expectedCurrent}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
