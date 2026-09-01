#!/usr/bin/env bash
#
# Prüft, ob sich die Datenbank allein aus den Migrationen aufbauen lässt.
#
# WARUM ES DAS GIBT
# Migrationen werden von Hand eingespielt. Legt jemand eine Tabelle direkt
# in der Supabase-Oberfläche an, läuft die Anwendung weiter — nur der
# versionierte Stand kann die Datenbank dann nicht mehr herstellen. Genau
# das war der Fall: `calendar_feed_tokens` und `customer_notes` fehlten,
# und eine spätere Migration brach deshalb mittendrin ab, wodurch alles
# nach der Abbruchstelle stillschweigend ausblieb. Aufgefallen ist das
# erst, als jemand die Kette gegen eine leere Datenbank laufen liess.
#
# VERWENDUNG
#   scripts/check-migrations.sh
# Erwartet ein erreichbares PostgreSQL über die üblichen PG*-Variablen
# (PGHOST, PGPORT, PGUSER, PGPASSWORD). Legt eine eigene Wegwerf-Datenbank
# an und räumt sie hinterher wieder ab.

set -euo pipefail

DB="${MIGRATION_CHECK_DB:-wg_migration_check}"
WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHIM="$WURZEL/supabase/test/supabase-shim.sql"
MIGRATIONEN="$WURZEL/supabase/migrations"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql nicht gefunden — dieser Test braucht einen PostgreSQL-Client." >&2
  exit 1
fi

aufraeumen() {
  psql -v ON_ERROR_STOP=0 -q -d postgres \
    -c "DROP DATABASE IF EXISTS $DB;" >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

echo "Wegwerf-Datenbank $DB anlegen"
aufraeumen
psql -v ON_ERROR_STOP=1 -q -d postgres -c "CREATE DATABASE $DB;"

echo "Supabase-Umgebung nachbilden"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$SHIM"

echo "Migrationen der Reihe nach einspielen"
fehler=0
anzahl=0
for datei in "$MIGRATIONEN"/*.sql; do
  anzahl=$((anzahl + 1))
  name="$(basename "$datei")"
  if ausgabe="$(psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$datei" 2>&1)"; then
    :
  else
    echo ""
    echo "FEHLGESCHLAGEN: $name"
    echo "$ausgabe" | grep -m3 -i "error" || echo "$ausgabe" | head -5
    fehler=$((fehler + 1))
  fi
done

echo ""
if [ "$fehler" -eq 0 ]; then
  echo "Alle $anzahl Migrationen bauen die Datenbank von null auf."
  exit 0
fi

cat >&2 <<MELDUNG

$fehler von $anzahl Migrationen sind fehlgeschlagen.

Das heisst NICHT unbedingt, dass die Produktion kaputt ist — dort kann der
fehlende Teil längst von Hand angelegt worden sein. Es heisst, dass der
versionierte Stand die Datenbank nicht herstellen kann: eine Testumgebung
oder ein Wiederaufbau nach einem Ausfall ergäbe eine andere Datenbank.

Fehlt der Migration etwas, das Supabase mitbringt, gehört es in
supabase/test/supabase-shim.sql. Fehlt eine eigene Tabelle, gehört sie als
Migration nachgetragen.
MELDUNG
exit 1
