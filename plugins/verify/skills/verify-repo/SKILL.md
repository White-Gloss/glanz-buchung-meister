---
name: verify-repo
description: Run glanz-buchung-meister's CI gates (lint, typecheck, tests, build, DB/RLS checks) locally before declaring work done, committing, pushing, or opening a PR — and whenever the user asks whether the code "passes", "is green", or "would pass CI".
---

# Verify the repository before claiming it works

This repo's CI (`.github/workflows/ci.yml`) runs two jobs: `verify` (Node) and a PostgreSQL job.
The script `${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.sh` reproduces them locally and prints one
summary table, so you never have to remember the individual commands.

## Which profile to run

| Situation                                                                       | Command                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------- |
| Edited TS/TSX in `src/`, `server/`, `scripts/`                                  | `run-gates.sh quick` (lint, typecheck, test) |
| Before a commit/push/PR, or touched build config, routes, SSR, `vite.config.ts` | `run-gates.sh full`                          |
| Edited `supabase/functions/`                                                    | `run-gates.sh functions`                     |
| Added or changed `migrations/` or RLS policies                                  | `run-gates.sh db` (needs PostgreSQL)         |
| Dev server running and auth flag in question                                    | `run-gates.sh auth`                          |

Gates can be combined: `run-gates.sh typecheck test build`.

## How to run it

- Always invoke via the Bash tool: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.sh <profile>`.
  Give `full`/`all` a 10-minute timeout; the production build is the slow step.
- `npm test` runs an explicit file list in `package.json`. If you added a new `*.test.ts`,
  make sure it is in that list — otherwise the `test` gate passes without running it.
- `typecheck` must run before `build`: the build regenerates `src/routeTree.gen.ts`
  and would hide a stale checked-in route tree.

## Reading the result

- `PASS` — gate green. `FAIL` — the script prints the last 40 lines of its log; the
  full log path is in the table. `SKIP` — gate could not run here (e.g. no PostgreSQL,
  no build output); say so explicitly, never count it as passed.
- Exit code 1 means at least one FAIL.
- Fix root causes. Never skip, disable, or delete a test, and never loosen a lint rule
  or RLS policy to turn a gate green.

Report the table to the user as-is, then one line per FAIL/SKIP with cause and next step.
