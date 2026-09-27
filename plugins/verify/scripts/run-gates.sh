#!/usr/bin/env bash
#
# Runs the repository's CI gates locally and prints a compact summary.
#
# USAGE
#   run-gates.sh [profile|gate ...]
#
# Profiles (mirror .github/workflows/ci.yml):
#   quick  lint, typecheck, test                           (default)
#   full   quick + functions, syntax, build, qa
#   db     migrations, rls, erpnext   (needs PostgreSQL via PG* variables)
#   all    full + db
#
# Single gates: lint typecheck test functions syntax build qa
#               migrations rls erpnext auth
#
# Every gate runs even if an earlier one fails, except `qa`, which needs the
# output of `build` and is skipped when the build failed. Logs go to
# $VERIFY_LOG_DIR (default: a fresh temp directory). Exit code is 1 if any
# gate failed, 0 otherwise (skips do not fail the run).

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 2

LOG_DIR="${VERIFY_LOG_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/verify-gates.XXXXXX")}"
mkdir -p "$LOG_DIR"

expand() {
  case "$1" in
    quick) echo "lint typecheck test" ;;
    full) echo "lint typecheck functions test syntax build qa" ;;
    db) echo "migrations rls erpnext" ;;
    all) echo "lint typecheck functions test syntax build qa migrations rls erpnext" ;;
    lint | typecheck | test | functions | syntax | build | qa | migrations | rls | erpnext | auth) echo "$1" ;;
    *)
      echo "Unknown profile or gate: $1" >&2
      echo "Profiles: quick full db all — gates: lint typecheck test functions syntax build qa migrations rls erpnext auth" >&2
      exit 2
      ;;
  esac
}

GATES=()
if [ "$#" -eq 0 ]; then set -- quick; fi
for arg in "$@"; do
  expanded="$(expand "$arg")" || exit 2
  for g in $expanded; do
    case " ${GATES[*]-} " in *" $g "*) ;; *) GATES+=("$g") ;; esac
  done
done

pg_reachable() {
  command -v psql >/dev/null 2>&1 || return 1
  command -v pg_isready >/dev/null 2>&1 || return 1
  pg_isready -q -t 3 >/dev/null 2>&1
}

# Echoes a skip reason and returns 0 when the gate cannot run here.
skip_reason() {
  case "$1" in
    migrations | rls | erpnext)
      if ! pg_reachable; then
        echo "no PostgreSQL reachable (set PGHOST/PGPORT/PGUSER/PGPASSWORD)"
        return 0
      fi
      ;;
    qa)
      if [ "${BUILD_FAILED:-0}" = 1 ]; then
        echo "build failed"
        return 0
      fi
      if [ ! -f .output/server/index.mjs ]; then
        echo "no build output — run the build gate first"
        return 0
      fi
      ;;
  esac
  return 1
}

run_gate() {
  case "$1" in
    lint) npm run --silent lint ;;
    typecheck) npm run --silent typecheck ;;
    test) npm test --silent ;;
    functions) npm run --silent typecheck:functions ;;
    syntax)
      bash -n scripts/deploy-ionos-release.sh &&
        node --check scripts/smoke-production.mjs &&
        node --check scripts/write-google-oauth.mjs &&
        node --check scripts/audit-domain-migration.mjs &&
        node --check scripts/qa/run-checks.mjs &&
        node --check lighthouserc.mobile.cjs &&
        node --check lighthouserc.desktop.cjs &&
        bash -n scripts/check-migrations.sh &&
        bash -n scripts/check-rls.sh &&
        bash -n scripts/check-erpnext-operational-approval.sh
      ;;
    build) npm run --silent build ;;
    qa) node scripts/qa/run-checks.mjs ;;
    migrations) npm run --silent check:migrations ;;
    rls) npm run --silent check:rls ;;
    erpnext) npm run --silent check:erpnext-approval ;;
    auth) npm run --silent check:auth ;;
  esac
}

declare -a ROWS
FAILED=0
BUILD_FAILED=0

for gate in "${GATES[@]}"; do
  log="$LOG_DIR/$gate.log"
  if reason="$(skip_reason "$gate")"; then
    ROWS+=("SKIP|$gate|-|$reason")
    continue
  fi
  start=$(date +%s)
  run_gate "$gate" >"$log" 2>&1
  code=$?
  secs=$(($(date +%s) - start))
  # check:auth exits 2 when no dev server is running to compare against.
  if [ "$gate" = auth ] && [ "$code" = 2 ]; then
    ROWS+=("SKIP|$gate|${secs}s|no running dev server to compare against")
  elif [ "$code" = 0 ]; then
    ROWS+=("PASS|$gate|${secs}s|")
  else
    FAILED=1
    [ "$gate" = build ] && BUILD_FAILED=1
    ROWS+=("FAIL|$gate|${secs}s|exit $code — $log")
  fi
done

echo
echo "Gate summary (logs: $LOG_DIR)"
printf '%-5s %-11s %-7s %s\n' STATE GATE TIME NOTE
for row in "${ROWS[@]}"; do
  IFS='|' read -r state gate secs note <<<"$row"
  printf '%-5s %-11s %-7s %s\n' "$state" "$gate" "$secs" "$note"
done

if [ "$FAILED" = 1 ]; then
  for row in "${ROWS[@]}"; do
    IFS='|' read -r state gate _ _ <<<"$row"
    [ "$state" = FAIL ] || continue
    echo
    echo "── last 40 lines of $gate ──"
    tail -n 40 "$LOG_DIR/$gate.log"
  done
  exit 1
fi
exit 0
