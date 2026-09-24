#!/usr/bin/env bash
# Richtet einen eigenen GitHub-Actions-Runner auf einem separaten VPS ein
# (gedacht für Hostinger, Ubuntu 22.04/24.04). Nicht auf dem Produktionsserver.
#
# Aufruf als root:
#   RUNNER_TOKEN=<Token aus GitHub> bash setup-ci-runner.sh
#
# Das Token steht unter GitHub → Repository → Settings → Actions → Runners →
# „New self-hosted runner“ (Zeile „--token …“). Es gilt eine Stunde und wird
# nicht gespeichert.
set -Eeuo pipefail

REPO_URL="https://github.com/White-Gloss/glanz-buchung-meister"
RUNNER_USER="gh-runner"
RUNNER_HOME="/opt/actions-runner"
RUNNER_LABEL="white-gloss-ci"

fail() { echo "Abbruch: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "bitte als root ausführen."
[[ -n "${RUNNER_TOKEN:-}" ]] || fail "RUNNER_TOKEN fehlt (siehe Kopfkommentar)."
# Der Runner führt Code aus Branches aus. Auf dem Produktionsserver hätte er
# Zugriff auf dieselbe Maschine wie die Kundendaten.
[[ ! -e /etc/white-gloss ]] || fail "das ist der Produktionsserver. Runner nur auf einem separaten VPS."
command -v apt-get >/dev/null || fail "nur für Ubuntu/Debian."
[[ "$(uname -m)" == "x86_64" ]] || fail "nur x86_64 wird unterstützt."

echo "▸ Pakete installieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q --no-install-recommends \
  ca-certificates curl git jq tar unzip docker.io postgresql-client
systemctl enable --now docker

# Lighthouse braucht Chrome; das Ubuntu-Paket „chromium“ ist nur ein Snap.
if ! command -v google-chrome >/dev/null; then
  echo "▸ Google Chrome installieren"
  curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  apt-get install -y -q /tmp/chrome.deb
  rm -f /tmp/chrome.deb
fi

echo "▸ Benutzer ${RUNNER_USER} (ohne sudo)"
id "$RUNNER_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$RUNNER_USER"
# Für den PostgreSQL-Dienstcontainer im CI-Job „schema“.
usermod -aG docker "$RUNNER_USER"

echo "▸ Runner herunterladen und Prüfsumme kontrollieren"
release="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest)"
version="$(jq -r .tag_name <<<"$release" | sed 's/^v//')"
expected="$(jq -r .body <<<"$release" |
  sed -n 's/.*<!-- BEGIN SHA linux-x64 -->\([0-9a-f]\{64\}\)<!-- END SHA linux-x64 -->.*/\1/p' | head -n1)"
[[ -n "$version" && -n "$expected" ]] || fail "Runner-Version oder Prüfsumme nicht ermittelbar."
archive="actions-runner-linux-x64-${version}.tar.gz"
install -d -o "$RUNNER_USER" -g "$RUNNER_USER" "$RUNNER_HOME"
curl -fsSL -o "/tmp/${archive}" \
  "https://github.com/actions/runner/releases/download/v${version}/${archive}"
echo "${expected}  /tmp/${archive}" | sha256sum -c - >/dev/null || fail "Prüfsumme stimmt nicht."
tar -xzf "/tmp/${archive}" -C "$RUNNER_HOME"
rm -f "/tmp/${archive}"
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"
"$RUNNER_HOME/bin/installdependencies.sh" >/dev/null

echo "▸ Runner beim Repository anmelden"
sudo -u "$RUNNER_USER" "$RUNNER_HOME/config.sh" --unattended --replace \
  --url "$REPO_URL" --token "$RUNNER_TOKEN" \
  --name "$(hostname)-ci" --labels "$RUNNER_LABEL" --work _work

echo "▸ Als Systemdienst starten"
cd "$RUNNER_HOME"
./svc.sh install "$RUNNER_USER" >/dev/null
./svc.sh start >/dev/null
./svc.sh status | grep -q "active (running)" || fail "Dienst läuft nicht (./svc.sh status)."

cat <<EOF

Fertig. Runner ${version} läuft als Dienst unter ${RUNNER_USER}.
Letzter Schritt in GitHub → Settings → Secrets and variables → Actions → Variables:
  Name:  CI_RUNS_ON
  Wert:  ["self-hosted","${RUNNER_LABEL}"]
Zurück zu den GitHub-Runnern: die Variable löschen.
EOF
