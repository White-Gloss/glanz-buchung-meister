# verify — Claude Code plugin

Runs the glanz-buchung-meister CI gates locally and reports a compact pass/fail table.

## What it adds

- **`/verify [quick|full|db|all|<gate> ...]`** — slash command that runs the gates and explains any failure.
- **`verify-repo` skill** — Claude loads it automatically before declaring work done, committing, or opening a PR.
- **`scripts/run-gates.sh`** — the runner; also usable without Claude:
  `bash plugins/verify/scripts/run-gates.sh full`

## Profiles and gates

| Profile           | Gates                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `quick` (default) | `lint`, `typecheck`, `test`                                                                   |
| `full`            | `quick` + `functions` (Deno edge functions), `syntax`, `build`, `qa`                          |
| `db`              | `migrations`, `rls`, `erpnext` — needs PostgreSQL via `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD` |
| `all`             | `full` + `db`                                                                                 |

Extra gate, not in any profile: `auth` (`npm run check:auth`, needs a running dev server).

Gates that can't run in the current environment are reported as `SKIP`, never as `PASS`.
Logs land in `$VERIFY_LOG_DIR` (default: a fresh temp directory).

## Installation

The repo is its own plugin marketplace (`.claude-plugin/marketplace.json`), and
`.claude/settings.json` registers it and enables the plugin, so Claude Code offers to
install it when you trust the project folder. Manually:

```
/plugin marketplace add White-Gloss/glanz-buchung-meister
/plugin install verify@white-gloss
```

For local development against a checkout: `claude --plugin-dir ./plugins/verify`.
