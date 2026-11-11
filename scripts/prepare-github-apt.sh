#!/usr/bin/env bash
set -euo pipefail

# Only the disposable GitHub runner may change its package sources. The
# restricted runner on the production VPS must never execute this helper.
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${WG_CI_RUNNER_ENVIRONMENT:-}" != "github-hosted" ]]; then
  echo "Package-source preparation is restricted to GitHub-hosted CI runners." >&2
  exit 1
fi

# The Azure mirror can stall every package download until the job expires:
# https://github.com/actions/runner-images/issues/14594
# Keep Ubuntu's signed repositories and the other configured fallbacks; use
# the official HTTPS archive for this one failing mirror.
for source_file in \
  /etc/apt/apt-mirrors.txt \
  /etc/apt/apt-mirrors-security.txt \
  /etc/apt/sources.list \
  /etc/apt/sources.list.d/ubuntu.sources; do
  if [[ -f "$source_file" ]]; then
    sudo sed -i 's|http[s]*://azure\.archive\.ubuntu\.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' "$source_file"
  fi
done

# A failed download must fail the install, rather than consume the complete
# browser-test budget. Package signatures and verification remain unchanged.
sudo tee /etc/apt/apt.conf.d/99white-gloss-ci-network >/dev/null <<'APT'
Acquire::Retries "1";
Acquire::http::Timeout "15";
Acquire::https::Timeout "15";
APT
