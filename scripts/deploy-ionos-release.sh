#!/usr/bin/env bash

set -Eeuo pipefail

action="${1:-}"
deploy_root="${2:-}"
service_name="${3:-}"
release_id="${4:-}"
archive_path="${5:-}"
healthcheck_url="${6:-}"

die() {
  printf 'IONOS deployment error: %s\n' "$*" >&2
  exit 1
}

[[ "$deploy_root" == /opt/white-gloss ]] || die "unexpected deployment root"
[[ "$service_name" == white-gloss.service ]] || die "unexpected systemd service"
[[ "$release_id" =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ ]] || die "invalid release id"
[[ "$healthcheck_url" == http://127.0.0.1:3000/ ]] || die "unexpected healthcheck URL"

releases_dir="$deploy_root/releases"
current_link="$deploy_root/current"
target_release="$releases_dir/$release_id"

restart_and_wait() {
  sudo --non-interactive /usr/bin/systemctl restart "$service_name"
  for _ in {1..30}; do
    if curl --silent --show-error --fail --max-time 3 "$healthcheck_url" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

activate_release() {
  [[ "$archive_path" == /tmp/white-gloss-*.tgz ]] || die "invalid archive path"
  [[ -f "$archive_path" ]] || die "release archive not found"
  [[ ! -e "$target_release" ]] || die "release already exists"

  install -d -m 750 "$releases_dir"
  incomplete_release="${target_release}.incomplete.$$"
  trap 'rm -rf -- "$incomplete_release"' EXIT
  install -d -m 750 "$incomplete_release"
  tar --extract --gzip --file "$archive_path" --directory "$incomplete_release" \
    --no-same-owner --no-same-permissions
  [[ -f "$incomplete_release/server/index.mjs" ]] || die "server entrypoint missing"
  mv -- "$incomplete_release" "$target_release"
  trap - EXIT

  previous_path="$(readlink -f "$current_link" 2>/dev/null || true)"
  previous_id=""
  if [[ -n "$previous_path" ]]; then
    [[ "$previous_path" == "$releases_dir/"* ]] || die "current symlink leaves release directory"
    previous_id="${previous_path##*/}"
  fi

  ln -s "$target_release" "${current_link}.next"
  mv -Tf "${current_link}.next" "$current_link"

  if ! restart_and_wait; then
    if [[ -n "$previous_path" && -f "$previous_path/server/index.mjs" ]]; then
      ln -s "$previous_path" "${current_link}.rollback"
      mv -Tf "${current_link}.rollback" "$current_link"
      restart_and_wait || true
    fi
    die "new release failed its local healthcheck"
  fi

  printf '%s\n' "$previous_id"
}

rollback_release() {
  [[ -f "$target_release/server/index.mjs" ]] || die "rollback release not found"
  ln -s "$target_release" "${current_link}.rollback"
  mv -Tf "${current_link}.rollback" "$current_link"
  restart_and_wait || die "rollback release failed its local healthcheck"
}

case "$action" in
  activate)
    activate_release
    ;;
  rollback)
    rollback_release
    ;;
  *)
    die "expected activate or rollback"
    ;;
esac
