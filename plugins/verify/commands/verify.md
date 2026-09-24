---
description: Run the repo's CI gates locally and summarize pass/fail
argument-hint: "[quick|full|db|all|<gate> ...]"
allowed-tools: Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.sh:*), Read
---

Run the local CI gates for this repository.

1. Execute with the Bash tool (use a 10-minute timeout; `full`/`all` include a production build):

   `bash ${CLAUDE_PLUGIN_ROOT}/scripts/run-gates.sh $ARGUMENTS`

   With no arguments this runs the `quick` profile (lint, typecheck, test).
   Other profiles: `full` (adds Deno edge-function typecheck, script syntax checks, build, isolated QA),
   `db` (migrations, RLS attack test, ERPNext approval — needs PostgreSQL via `PG*` variables), `all`.
   Single gates can be named directly, e.g. `/verify typecheck test`.

2. Reply with the summary table the script prints, verbatim, followed by:
   - For each FAIL: the root cause in one or two sentences, quoting the decisive error lines from its log
     (read the full log file if the printed tail is not enough), and the file:line to fix.
   - For each SKIP: why it was skipped and what would be needed to run it.

3. Do not fix anything unless the user asked for fixes. Never report a gate as passing that the script
   reported as FAIL or SKIP.
