#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

[[ $(id -u) == 0 && $(uname -s) == Linux ]] || {
  echo 'Als root auf dem Hostinger-VPS ausführen.' >&2
  exit 1
}
[[ $# == 1 ]] || {
  echo 'Aufruf: install-hostinger-ci.sh ÖFFENTLICHER_ED25519_SCHLÜSSEL' >&2
  exit 1
}
public_key=$(realpath -e -- "$1")
[[ -f $public_key && ! -L $public_key ]] || exit 1
/usr/bin/python3 -I - "$public_key" <<'PY'
import base64
import pathlib
import sys

lines = pathlib.Path(sys.argv[1]).read_text().splitlines()
if len(lines) != 1:
    raise SystemExit("Genau ein öffentlicher Schlüssel ist erforderlich.")
parts = lines[0].split()
if len(parts) < 2 or parts[0] != "ssh-ed25519":
    raise SystemExit("Nur ein öffentlicher ED25519-Schlüssel ist zulässig.")
try:
    base64.b64decode(parts[1], validate=True)
except ValueError:
    raise SystemExit("Ungültiger öffentlicher Schlüssel.")
PY

source_directory=$(dirname -- "$(realpath -e -- "${BASH_SOURCE[0]}")")
repository_root=$(dirname -- "$source_directory")
helper="$repository_root/scripts/deploy-ionos-release.sh"
unit="$source_directory/white-gloss.service"
sudoers="$source_directory/white-gloss-booking-ci.sudoers"
for asset in "$helper" "$unit" "$sudoers"; do
  [[ -f $asset && ! -L $asset ]] || {
    echo "Deploydatei fehlt oder ist unsicher: $asset" >&2
    exit 1
  }
done

# Bestehende Produktion niemals durch den Bootstrap ersetzen oder neu starten.
[[ -f /etc/white-gloss/environment ]] || {
  echo 'Bestehende Produktionsumgebung fehlt; Bootstrap abgebrochen.' >&2
  exit 1
}
systemctl is-active --quiet white-gloss.service
systemctl is-active --quiet white-gloss-reminder.timer
cmp --silent "$unit" /etc/systemd/system/white-gloss.service || {
  echo 'Die installierte systemd-Unit weicht vom geprüften Repository ab.' >&2
  exit 1
}
[[ $(docker inspect --format '{{.State.Running}}' white-gloss-edge 2>/dev/null) == true ]] || {
  echo 'Caddy-Container white-gloss-edge ist nicht aktiv.' >&2
  exit 1
}
active=$(basename -- "$(readlink -f /srv/white-gloss-current)")
[[ $active =~ ^[0-9a-f]{40}$ ]] || {
  echo 'Aktiver Produktionscommit ist nicht eindeutig.' >&2
  exit 1
}

id white-gloss-ci >/dev/null 2>&1 || useradd --create-home --shell /bin/bash white-gloss-ci
install -d -m 0750 -o white-gloss-ci -g white-gloss-ci /home/white-gloss-ci
install -d -m 0750 -o white-gloss-ci -g white-gloss-ci /home/white-gloss-ci/incoming
install -d -m 0700 -o white-gloss-ci -g white-gloss-ci /home/white-gloss-ci/.ssh
authorized_keys=/home/white-gloss-ci/.ssh/authorized_keys
if [[ ! -e $authorized_keys ]]; then
  install -m 0600 -o white-gloss-ci -g white-gloss-ci /dev/null "$authorized_keys"
fi
[[ -f $authorized_keys && ! -L $authorized_keys ]] || {
  echo 'authorized_keys ist kein reguläres sicheres Ziel.' >&2
  exit 1
}
chown white-gloss-ci:white-gloss-ci "$authorized_keys"
chmod 0600 "$authorized_keys"
if ! grep -qxF -- "$(<"$public_key")" "$authorized_keys"; then
  printf '%s\n' "$(<"$public_key")" >> "$authorized_keys"
fi

install -m 0755 -o root -g root "$helper" /usr/local/sbin/white-gloss-deploy
install -m 0440 -o root -g root "$sudoers" /etc/sudoers.d/white-gloss-booking-ci
visudo -cf /etc/sudoers.d/white-gloss-booking-ci
sudo -l -U white-gloss-ci | grep -qF /usr/local/sbin/white-gloss-deploy

printf 'Hostinger-CI eingerichtet. Aktiver Buchungscommit: %s\n' "$active"
printf 'Anwendung, Umgebung, Datenbank, Dienste und Caddy wurden nicht verändert.\n'
