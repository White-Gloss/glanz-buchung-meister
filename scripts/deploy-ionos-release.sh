#!/usr/bin/env bash

set -Eeuo pipefail

readonly RELEASES_DIR="/srv/white-gloss-releases"
readonly CURRENT_LINK="/srv/white-gloss-current"
readonly SERVICE_NAME="white-gloss.service"
readonly RUNTIME_USER="deploy"
readonly RUNTIME_GROUP="deploy"
readonly CI_USER="white-gloss-ci"
readonly INCOMING_DIR="/home/white-gloss-ci/incoming"
readonly STAGING_DIR="/var/lib/white-gloss-deploy"
readonly HEALTHCHECK_URL="http://127.0.0.1:3000/"
# This helper is installed before migration 0007. Its minimum contract applies
# even during the first cutover, when the currently linked release is older.
readonly BOOKING_CONTRACT="white-gloss-booking-workflow=1"

die() {
  printf 'White Gloss deployment error: %s\n' "$*" >&2
  exit 1
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || die "must run as root"
}

validate_server_contract() {
  [[ -d "$RELEASES_DIR" ]] || die "release directory is missing"
  [[ "$(systemctl show "$SERVICE_NAME" -p User --value)" == "$RUNTIME_USER" ]] ||
    die "unexpected runtime user"
  [[ "$(systemctl show "$SERVICE_NAME" -p Group --value)" == "$RUNTIME_GROUP" ]] ||
    die "unexpected runtime group"
}

validate_release_id() {
  [[ "$1" =~ ^[0-9a-f]{40}$ ]] || die "invalid release id"
}

release_path() {
  printf '%s/%s\n' "$RELEASES_DIR" "$1"
}

release_is_compatible() {
  local target_release contract_file
  target_release="$(release_path "$1")"
  contract_file="$target_release/.output/booking-workflow.contract"
  [[ -d "$target_release" && -f "$target_release/.output/server/index.mjs" &&
     -f "$contract_file" && ! -L "$contract_file" ]] || return 1
  cmp --silent "$contract_file" <(printf '%s\n' "$BOOKING_CONTRACT")
}

validate_release() {
  local target_release
  target_release="$(release_path "$1")"
  [[ -d "$target_release" ]] || die "release directory is missing"
  [[ -f "$target_release/.output/server/index.mjs" ]] ||
    die "server entrypoint is missing"
  release_is_compatible "$1" ||
    die "release lacks the required booking workflow contract; activation and rollback are refused"
}

current_release_id() {
  local current_path
  current_path="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
  [[ -n "$current_path" ]] || return 0
  [[ "$current_path" == "$RELEASES_DIR/"* ]] ||
    die "current symlink leaves the release directory"
  basename "$current_path"
}

restart_and_wait() {
  systemctl restart "$SERVICE_NAME" || return 1
  for _ in {1..30}; do
    if curl --silent --show-error --fail --max-time 3 \
      "$HEALTHCHECK_URL" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

switch_release() {
  local release_id previous_id previous_path target_release next_link
  release_id="$1"
  validate_release "$release_id"
  target_release="$(release_path "$release_id")"
  previous_id="$(current_release_id)"
  previous_path=""
  # workflow_run accepts only an actual SHA that this helper can restore.
  # Preserve manually named legacy releases, but do not advertise them as a
  # usable rollback target after the booking schema migration.
  if [[ "$previous_id" =~ ^[0-9a-f]{40}$ ]] && release_is_compatible "$previous_id"; then
    previous_path="$(release_path "$previous_id")"
  else
    previous_id=""
  fi

  next_link="${CURRENT_LINK}.next.$$"
  ln -s "$target_release" "$next_link"
  mv -Tf "$next_link" "$CURRENT_LINK"

  if restart_and_wait; then
    printf '%s\n' "$previous_id"
    return 0
  fi

  if [[ -n "$previous_path" ]] && release_is_compatible "$previous_id"; then
    next_link="${CURRENT_LINK}.rollback.$$"
    ln -s "$previous_path" "$next_link"
    mv -Tf "$next_link" "$CURRENT_LINK"
    if restart_and_wait; then
      die "new release failed its local healthcheck; compatible previous release restored"
    fi
  fi
  systemctl stop "$SERVICE_NAME" ||
    die "release recovery failed and the service could not be stopped; operator intervention required"
  die "release healthcheck failed; no healthy compatible rollback available; service stopped, database unchanged"
}

validate_archive_members() {
  local archive_path member normalized metadata
  archive_path="$1"
  while IFS= read -r member; do
    normalized="${member#./}"
    case "$normalized" in
      .output | .output/*) ;;
      *) die "archive contains a path outside .output" ;;
    esac
    case "/$normalized/" in
      */../* | *$'\n'* | *$'\r'*) die "archive contains an unsafe path" ;;
    esac
  done < <(tar --list --gzip --file "$archive_path")

  while IFS= read -r metadata; do
    case "${metadata:0:1}" in
      - | d) ;;
      *) die "archive contains an unsupported entry type" ;;
    esac
  done < <(tar --list --verbose --gzip --file "$archive_path")
}

extract_release() {
  local release_id archive_path target_release incomplete_release archive_owner
  local archive_mode staged_archive
  release_id="$1"
  archive_path="$2"
  target_release="$(release_path "$release_id")"

  [[ "$archive_path" == "$INCOMING_DIR/$release_id.tgz" ]] ||
    die "unexpected archive path"
  [[ -f "$archive_path" && ! -L "$archive_path" ]] ||
    die "release archive is missing or unsafe"
  archive_owner="$(stat -c '%U' "$archive_path")"
  [[ "$archive_owner" == "$CI_USER" ]] || die "unexpected archive owner"
  archive_mode="$(stat -c '%a' "$archive_path")"
  (( (8#$archive_mode & 8#022) == 0 )) ||
    die "release archive is writable by group or others"

  install -d -o root -g root -m 700 "$STAGING_DIR"
  staged_archive="$STAGING_DIR/$release_id.$$.tgz"
  install -o root -g root -m 600 "$archive_path" "$staged_archive"
  validate_archive_members "$staged_archive"

  if [[ -e "$target_release" ]]; then
    validate_release "$release_id"
    rm -f -- "$staged_archive"
    return 0
  fi

  incomplete_release="${target_release}.incomplete.$$"
  trap 'rm -f -- "$staged_archive"; rm -rf -- "$incomplete_release"' EXIT
  install -d -o root -g "$RUNTIME_GROUP" -m 750 "$incomplete_release"
  tar --extract --gzip --file "$staged_archive" --directory "$incomplete_release" \
    --no-same-owner --no-same-permissions

  if find "$incomplete_release" ! -type d ! -type f -print -quit | grep -q .; then
    die "release contains unsupported file types"
  fi
  [[ -f "$incomplete_release/.output/server/index.mjs" ]] ||
    die "server entrypoint is missing"

  chown -R root:"$RUNTIME_GROUP" "$incomplete_release"
  find "$incomplete_release" -type d -exec chmod 750 {} +
  find "$incomplete_release" -type f -exec chmod 640 {} +
  mv -- "$incomplete_release" "$target_release"
  rm -f -- "$staged_archive"
  trap - EXIT
}

activate_release() {
  local release_id archive_path
  release_id="$1"
  archive_path="$2"
  validate_release_id "$release_id"
  extract_release "$release_id" "$archive_path"
  switch_release "$release_id"
}

rollback_release() {
  local release_id
  release_id="$1"
  validate_release_id "$release_id"
  # Invalid recovery targets must never mutate an otherwise healthy service.
  if ! release_is_compatible "$release_id"; then
    die "incompatible rollback refused; current release and service unchanged; deploy a compatible release"
  fi
  switch_release "$release_id" >/dev/null
}

main() {
  require_root
  validate_server_contract
  case "${1:-}" in
    activate)
      [[ "$#" -eq 3 ]] || die "activate expects release id and archive path"
      activate_release "$2" "$3"
      ;;
    rollback)
      [[ "$#" -eq 2 ]] || die "rollback expects a release id"
      rollback_release "$2"
      ;;
    *)
      die "expected activate or rollback"
      ;;
  esac
}

# Sourcing exposes functions to isolated contract tests; executable use always
# runs the existing root, archive ownership and server-contract checks.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
