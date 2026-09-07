#!/usr/bin/env bash
# Audited, opt-in preparation for native PostgreSQL 18 on Ubuntu 24.04.
# Does not start PostgreSQL, restore data, or alter the application's environment.
# Sources: https://www.postgresql.org/download/linux/ubuntu/
# https://www.postgresql.org/about/news/pgdg-apt-repository-for-debianubuntu-1432/
# https://manpages.ubuntu.com/manpages/noble/man1/needrestart.1.html
# https://manpages.debian.org/unstable/init-system-helpers/invoke-rc.d.8.en.html
set -euo pipefail

PGDG_FINGERPRINT=B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8
PGDG_KEY=/usr/share/keyrings/white-gloss-pgdg.asc
PGDG_SOURCE=/etc/apt/sources.list.d/white-gloss-pgdg.sources
POLICY_PATH=/usr/sbin/policy-rc.d

fail() { printf 'ERROR: %s\n' "$1" >&2; return 1; }

usage() {
  printf '%s\n' \
    'Usage: bash ops/install-postgresql18.sh prepare|check|install --live-pid PID' \
    'prepare: verify official key, add a dedicated source without overwriting, apt-get update, simulate.' \
    'check: verify existing configuration and simulate (no package/configuration changes).' \
    'install: repeat checks, install only new PG18 packages/dependencies, deny service actions.' \
    'A new empty 18/main cluster may be initialized; it must remain stopped.'
}

validate_plan() {
  # An Inst line containing [old-version] means an upgrade/reinstallation.
  # Require the English summary as well; fail closed for unfamiliar apt output.
  awk '
    /^Remv / { bad=1 }
    /^Inst / {
      count++
      if ($3 ~ /^\[/) bad=1
      if ($2 == "postgresql-18") server++
      if ($2 == "postgresql-client-18") client++
    }
    /^0 upgraded, [0-9]+ newly installed, 0 to remove and [0-9]+ not upgraded\.$/ {
      summary++; expected=$3
    }
    END { exit (bad || summary != 1 || count != expected || count < 2 || count > 32 || server != 1 || client != 1) }
  ' "$1" || fail 'Package plan is not a bounded fresh PG18 installation with zero upgrades/removals.'
}

read_live_identity() {
  local value rest comm main_pid
  local -a process_fields process_args
  [[ "$live_pid" =~ ^[1-9][0-9]*$ ]] || { fail 'Expected a numeric live PID.'; return 1; }
  [[ -r "/proc/$live_pid/stat" && -r "/proc/$live_pid/comm" ]] || { fail 'Expected live process is absent.'; return 1; }
  IFS= read -r comm < "/proc/$live_pid/comm" || { fail 'Cannot read live process name.'; return 1; }
  [[ "$comm" == node ]] || { fail 'Expected live PID is not a Node process.'; return 1; }
  main_pid=$(systemctl show white-gloss.service --property=MainPID --value) || { fail 'Cannot verify application service PID.'; return 1; }
  [[ "$main_pid" == "$live_pid" ]] || { fail 'Expected PID is not the current application service MainPID.'; return 1; }
  mapfile -d '' -t process_args < "/proc/$live_pid/cmdline" || { fail 'Cannot read live process arguments.'; return 1; }
  [[ "${#process_args[@]}" == 2 && "${process_args[0]}" == /usr/bin/node &&
     ( "${process_args[1]}" == /srv/white-gloss-current/.output/server/index.mjs ||
       "${process_args[1]}" == /srv/white-gloss-releases/*/.output/server/index.mjs ) ]] || { fail 'Live process entry point differs from the reviewed application.'; return 1; }
  IFS= read -r value < "/proc/$live_pid/stat" || { fail 'Cannot read live process identity.'; return 1; }
  rest=${value##*) }
  read -r -a process_fields <<< "$rest"
  [[ "${process_fields[0]:-Z}" != Z && "${process_fields[19]:-}" =~ ^[0-9]+$ ]] || { fail 'Live process state is invalid.'; return 1; }
  printf '%s\n' "${process_fields[19]}"
}

check_live() {
  local current
  current=$(read_live_identity) || return 1
  [[ "$current" == "$live_start" ]] || fail 'Live Node process disappeared or its identity changed. Stop recovery.'
}

check_regular_root_file() {
  [[ -f "$1" && ! -L "$1" && "$(stat -c %u "$1")" == 0 ]] || fail 'Expected a root-owned regular configuration file.'
  local mode
  mode=$(stat -c %a "$1")
  (( (8#$mode & 8#022) == 0 )) || fail 'Configuration file is writable by a non-root group or other users.'
}

verify_key() {
  local fingerprints
  fingerprints=$(gpg --batch --no-options --homedir "$work_dir/gnupg" --show-keys --with-colons "$1" 2>/dev/null |
    awk -F: '$1 == "pub" { primary=1; count++ } $1 == "fpr" && primary { print $10; primary=0 } END { if (count != 1) exit 1 }') || { fail 'PGDG key cannot be verified.'; return 1; }
  [[ "$fingerprints" == "$PGDG_FINGERPRINT" ]] || fail 'PGDG signing-key fingerprint mismatch.'
}

check_repository() {
  local file
  shopt -s nullglob
  for file in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
    [[ -f "$file" && "$file" != "$PGDG_SOURCE" ]] || continue
    if grep -q 'apt\.postgresql\.org' "$file"; then
      fail 'Another PGDG source already exists; review it instead of adding a duplicate.'
      return 1
    fi
  done
  if [[ -e "$PGDG_SOURCE" || -L "$PGDG_SOURCE" ]]; then
    check_regular_root_file "$PGDG_SOURCE"
    cmp -s "$work_dir/pgdg.sources" "$PGDG_SOURCE" || fail 'Existing dedicated PGDG source differs; it will not be overwritten.'
  fi
  if [[ -e "$PGDG_KEY" || -L "$PGDG_KEY" ]]; then
    check_regular_root_file "$PGDG_KEY"
    verify_key "$PGDG_KEY"
  fi
}

simulate() {
  check_live
  apt-cache policy postgresql-18 postgresql-client-18
  apt-get --simulate --no-install-recommends --no-remove install postgresql-18 postgresql-client-18 > "$work_dir/plan"
  cat "$work_dir/plan"
  validate_plan "$work_dir/plan"
  check_live
}

cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n "${policy_identity:-}" ]]; then
    if [[ ! -L "$POLICY_PATH" && "$(stat -c '%d:%i' "$POLICY_PATH" 2>/dev/null || true)" == "$policy_identity" ]]; then
      rm -- "$POLICY_PATH"
    else
      printf '%s\n' 'ERROR: Temporary service policy changed externally; leaving it untouched for review.' >&2
      status=1
    fi
  fi
  if [[ "${work_dir:-}" == /tmp/white-gloss-pg18.* && -d "$work_dir" && ! -L "$work_dir" ]]; then
    rm -r -- "$work_dir"
  fi
  exit "$status"
}

main() {
  if [[ "$#" == 1 && "$1" == --help ]]; then usage; return; fi
  [[ "$#" == 3 && "$2" == --live-pid && "$1" =~ ^(prepare|check|install)$ ]] || { usage >&2; return 1; }
  local action=$1 architecture tool installed_packages package_audit clusters
  live_pid=$3
  export PATH=/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l NEEDRESTART_SUSPEND=1
  [[ $EUID == 0 ]] || fail 'Run as root on the intended Ubuntu server.'
  [[ -r /etc/os-release ]] || fail 'Operating system metadata is missing.'
  # Trusted operating-system file, never an application .env or credentials file.
  . /etc/os-release
  [[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 24.04 && "${VERSION_CODENAME:-}" == noble ]] || fail 'Only Ubuntu 24.04 noble is supported.'
  for tool in apt-get apt-cache dpkg dpkg-query curl gpg awk grep cmp stat mktemp mkdir chmod rm cat systemctl; do
    command -v "$tool" >/dev/null || fail "Required tool missing: $tool. Review prerequisite installation separately."
  done
  [[ -s /etc/ssl/certs/ca-certificates.crt ]] || fail 'Existing system CA bundle is required.'
  architecture=$(dpkg --print-architecture)
  [[ "$architecture" == amd64 || "$architecture" == arm64 ]] || fail 'Only Ubuntu amd64/arm64 is supported by this helper.'
  live_start=$(read_live_identity)
  printf 'Live Node guard: pid=%s start_ticks=%s\n' "$live_pid" "$live_start"
  package_audit=$(dpkg --audit) || { fail 'Cannot verify package-manager state.'; return 1; }
  [[ -z "$package_audit" ]] || fail 'Package manager has pending/incomplete work; review it separately.'
  # Reject a pre-existing native server rather than accidentally upgrading it.
  installed_packages=$(dpkg-query -W '-f=${binary:Package}\t${db:Status-Status}\n') || { fail 'Cannot verify installed packages.'; return 1; }
  if awk '$1 ~ /^postgresql(-[0-9]+)?(:[^ ]+)?$/ && $2 == "installed" { found=1 } END { exit !found }' <<< "$installed_packages"; then
    fail 'A native PostgreSQL server is already installed; this fresh-install helper will not alter it.'
  fi
  work_dir=$(mktemp -d /tmp/white-gloss-pg18.XXXXXXXX)
  policy_identity=''
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  mkdir -m 700 "$work_dir/gnupg"
  cat > "$work_dir/pgdg.sources" <<EOF
Types: deb
URIs: https://apt.postgresql.org/pub/repos/apt
Suites: noble-pgdg
Architectures: $architecture
Components: main
Signed-By: $PGDG_KEY
EOF
  chmod 644 "$work_dir/pgdg.sources"
  check_repository
  if [[ "$action" == prepare ]]; then
    curl --proto '=https' --tlsv1.2 --fail --silent --show-error --connect-timeout 10 --max-time 60 \
      https://www.postgresql.org/media/keys/ACCC4CF8.asc -o "$work_dir/pgdg.asc"
    verify_key "$work_dir/pgdg.asc"
    chmod 644 "$work_dir/pgdg.asc"
    # noclobber refuses existing destinations; failures leave files for manual review.
    [[ -d /usr/share/keyrings && ! -L /usr/share/keyrings && -d /etc/apt/sources.list.d && ! -L /etc/apt/sources.list.d ]] || fail 'Expected system configuration directories are unavailable.'
    if [[ ! -e "$PGDG_KEY" ]]; then
      (set -o noclobber; cat "$work_dir/pgdg.asc" > "$PGDG_KEY")
      chmod 644 "$PGDG_KEY"
    fi
    if [[ ! -e "$PGDG_SOURCE" ]]; then
      (set -o noclobber; cat "$work_dir/pgdg.sources" > "$PGDG_SOURCE")
      chmod 644 "$PGDG_SOURCE"
    fi
    check_live
    apt-get update --error-on=any
  fi
  [[ -f "$PGDG_KEY" && -f "$PGDG_SOURCE" ]] || fail 'Run prepare before check/install.'
  check_repository
  simulate
  [[ "$action" == install ]] || return 0
  [[ ! -e "$POLICY_PATH" && ! -L "$POLICY_PATH" ]] || fail 'A service policy already exists; it will not be overwritten.'
  # Atomic non-overwriting creation; trap removes only the inode created here.
  (set -o noclobber; printf '#!/bin/sh\nexit 101\n' > "$POLICY_PATH")
  policy_identity=$(stat -c '%d:%i' "$POLICY_PATH")
  chmod 755 "$POLICY_PATH"
  check_live
  apt-get --assume-yes --no-install-recommends --no-upgrade --no-remove install postgresql-18 postgresql-client-18
  check_live
  /usr/lib/postgresql/18/bin/postgres --version
  /usr/lib/postgresql/18/bin/pg_dump --version
  /usr/lib/postgresql/18/bin/pg_restore --version
  pg_lsclusters
  clusters=$(pg_lsclusters --no-header) || { fail 'Cannot verify PostgreSQL cluster state.'; return 1; }
  if awk 'NF && $4 !~ /^down/ { bad=1 } END { exit !bad }' <<< "$clusters"; then
    fail 'A PostgreSQL cluster is running unexpectedly; stop and review. No service stop will be attempted here.'
  fi
  check_live
  printf '%s\n' 'PG18 installation complete; live Node identity unchanged. PostgreSQL start/import remains a separate explicit step.'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
