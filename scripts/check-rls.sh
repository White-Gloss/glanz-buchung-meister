#!/usr/bin/env bash
#
# Greift die Zugriffsregeln der Datenbank an, statt sie nur zu lesen.
#
# WARUM ES DAS GIBT
# Row Level Security ist die einzige Schranke, die zwischen einem fremden
# Browser und den Kundendaten steht, sobald jemand die Supabase-Schnittstelle
# direkt anspricht. Die Anwendung davorzuschalten ist keine Zugriffskontrolle
# — wer den Schlüssel aus dem Browser liest, redet mit der Datenbank ohne
# jede Oberfläche. Ob die Regeln wirklich greifen, sah man ihnen bisher nur
# an; geprüft hat es nichts.
#
# WAS GEPRÜFT WIRD
# Zwei Angreifer: ein nicht angemeldeter Besucher (`anon`) und ein
# angemeldeter Benutzer OHNE Administratorrolle (`authenticated`) — der
# gefährlichere von beiden, weil er bereits durch die Anmeldung hindurch ist.
#
# WAS NICHT GEPRÜFT WIRD
# Supabase selbst: die Prüfung des JWT, das API-Gateway, die Speicher-Regeln.
# Und ausdrücklich NICHT der zweite Datenbankweg der Anwendung: Serverfunktionen
# über `src/lib/db.server.ts` verbinden sich privilegiert und umgehen RLS von
# vornherein. Dort schützt allein deren eigenes `assertAdmin`. Ein gruener Lauf
# hier sagt also: die Regeln sind richtig gesetzt — nicht: jeder Weg in die
# Daten ist abgesichert.
#
# VERWENDUNG
#   scripts/check-rls.sh
# Erwartet ein erreichbares PostgreSQL über die üblichen PG*-Variablen.

set -euo pipefail

DB="${RLS_CHECK_DB:-wg_rls_check}"
WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NUTZER_OHNE_RECHTE='22222222-2222-4222-8222-222222222222'

command -v psql >/dev/null 2>&1 || { echo "psql nicht gefunden." >&2; exit 1; }

aufraeumen() {
  psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB;" >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

aufraeumen
psql -v ON_ERROR_STOP=1 -q -d postgres -c "CREATE DATABASE $DB;"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$WURZEL/supabase/test/supabase-shim.sql"
for datei in "$WURZEL"/supabase/migrations/*.sql; do
  PGOPTIONS="-c client_min_messages=warning" psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$datei" >/dev/null
done
psql -v ON_ERROR_STOP=1 -q --single-transaction -d "$DB" -f "$WURZEL/supabase/test/rls-testdaten.sql"

fehler=0
geprueft=0

# Fuehrt eine Anweisung als die angegebene Rolle aus und meldet, wie viele
# Zeilen sie tatsaechlich betrifft. Alles laeuft in einer Transaktion, die
# zurueckgerollt wird.
#
# WICHTIG: Gemessen werden ZEILEN, nicht Fehler. Ein UPDATE, das unter RLS
# keine Zeile findet, meldet keinen Fehler — es wirkt nur nicht. Wer auf
# "kein Fehler" prueft, haelt genau das faelschlich fuer einen Treffer.
treffer_von() {
  local rolle="$1" anweisung="$2" ausgabe
  ausgabe=$(psql -tA -d "$DB" <<SQL 2>&1
begin;
set local role $rolle;
select set_config('request.jwt.claim.sub', '$NUTZER_OHNE_RECHTE', true);
with ergebnis as ($anweisung) select 'N=' || count(*) from ergebnis;
rollback;
SQL
)
  if grep -qiE "permission denied|violates row-level|new row violates" <<<"$ausgabe"; then
    echo "abgewiesen"
  elif grep -qi "ERROR" <<<"$ausgabe"; then
    echo "PRUEFFEHLER: $(grep -m1 -i ERROR <<<"$ausgabe")"
  else
    grep -o 'N=[0-9]*' <<<"$ausgabe" | head -1 | cut -d= -f2
  fi
}

# erwarte <rolle> <erwartung: abgewiesen|0|zahl> <beschreibung> <anweisung>
erwarte() {
  local rolle="$1" erwartet="$2" was="$3" anweisung="$4" ist
  geprueft=$((geprueft + 1))
  ist="$(treffer_von "$rolle" "$anweisung")"
  if [ "$ist" = "$erwartet" ]; then
    printf "  ok    %-9s %s\n" "$rolle" "$was"
  else
    printf "  FEHLT %-9s %s — erwartet '%s', bekommen '%s'\n" "$rolle" "$was" "$erwartet" "$ist"
    fehler=$((fehler + 1))
  fi
}

echo "Lesen: was darf ein nicht angemeldeter Besucher sehen?"
erwarte anon abgewiesen "Buchungen"            "select id from public.bookings"
erwarte anon abgewiesen "Kundennotizen"        "select id from public.customer_notes"
erwarte anon abgewiesen "Kalender-Token"       "select id from public.calendar_feed_tokens"
erwarte anon abgewiesen "Zustandsmeldungen"    "select id from public.condition_reports"
erwarte anon abgewiesen "Stoerungsprotokoll"   "select id from public.system_events"
erwarte anon abgewiesen "Rollen"               "select user_id from public.user_roles"
erwarte anon abgewiesen "Pruefprotokoll"       "select id from public.booking_audit_log"
erwarte anon abgewiesen "Lebenszeichen"        "select area from public.automation_heartbeat"
erwarte anon abgewiesen "ERPNext-Einmalfreigaben" "select id from public.erpnext_write_approvals"

echo "Lesen: nur Veroeffentlichtes ist oeffentlich"
erwarte anon 1 "genau ein Blogbeitrag (nicht Entwurf, nicht geplant)" \
  "select id from public.blog_posts"
erwarte anon 1 "genau ein Galeriebild"  "select id from public.gallery_items"
erwarte anon 1 "genau eine FAQ"         "select id from public.faqs"

echo "Lesen: ein angemeldeter Benutzer ohne Administratorrolle"
erwarte authenticated 0 "sieht keine Buchung"          "select id from public.bookings"
erwarte authenticated 0 "sieht keine Kundennotiz"      "select id from public.customer_notes"
erwarte authenticated 0 "sieht keinen fremden Token"   "select id from public.calendar_feed_tokens"
erwarte authenticated 0 "sieht kein Stoerungsprotokoll" "select id from public.system_events"
erwarte authenticated 0 "sieht kein Pruefprotokoll"    "select id from public.booking_audit_log"
erwarte authenticated 0 "sieht kein Lebenszeichen"     "select area from public.automation_heartbeat"
erwarte authenticated abgewiesen "sieht keine ERPNext-Einmalfreigabe" \
  "select id from public.erpnext_write_approvals"
erwarte authenticated 1 "sieht die eigene Rolle, sonst keine" \
  "select user_id from public.user_roles"

echo "Schreiben: nichts davon darf wirken"
for rolle in anon authenticated; do
  case "$rolle" in anon) leer="abgewiesen" ;; *) leer=0 ;; esac
  erwarte "$rolle" "$leer" "Buchung auf Bezahlt setzen" \
    "update public.bookings set status='Bezahlt' returning id"
  erwarte "$rolle" "$leer" "Buchungen loeschen" \
    "delete from public.bookings returning id"
  erwarte "$rolle" "$leer" "Entwurf veroeffentlichen" \
    "update public.blog_posts set published_at=now() where published_at is null returning id"
  erwarte "$rolle" "$leer" "Kundennotiz ueberschreiben" \
    "update public.customer_notes set note='uebernommen' returning id"
  erwarte "$rolle" abgewiesen "sich selbst zum Administrator machen" \
    "insert into public.user_roles (user_id, role) values ('$NUTZER_OHNE_RECHTE','admin') returning user_id"
  erwarte "$rolle" abgewiesen "die eigene Rolle hochstufen" \
    "update public.user_roles set role='admin' returning user_id"
  erwarte "$rolle" abgewiesen "Preise aendern" \
    "update public.service_prices set amount=1 returning id"
  erwarte "$rolle" abgewiesen "Stoerungsprotokoll faelschen" \
    "delete from public.system_events returning id"
  erwarte "$rolle" abgewiesen "ERPNext-Einmalfreigabe anlegen" \
    "insert into public.erpnext_write_approvals
       (booking_id, booking_revision, scope, approved_by, expires_at)
     values
       ('33333333-3333-4333-8333-333333333333', now(), 'customer',
        '$NUTZER_OHNE_RECHTE', now() + interval '5 minutes')
     returning id"
  erwarte "$rolle" abgewiesen "ERPNext-Einmalfreigabe verbrauchen" \
    "update public.erpnext_write_approvals set consumed_at=now() returning id"
  erwarte "$rolle" abgewiesen "ERPNext-Einmalfreigabe loeschen" \
    "delete from public.erpnext_write_approvals returning id"

  erwarte "$rolle" abgewiesen "ERPNext-Einmalfreigabe-RPC ausfuehren" \
    "select public.create_erpnext_write_approval(
       '33333333-3333-4333-8333-333333333333'::uuid,
       now()::timestamptz,
       'customer'::text,
       '$NUTZER_OHNE_RECHTE'::uuid,
       300::integer
     ) as value"
  erwarte "$rolle" abgewiesen "ERPNext-Fahrzeugclaim mit Freigabe ausfuehren" \
    "select public.claim_erpnext_booking_sync(
       '33333333-3333-4333-8333-333333333333'::uuid,
       now()::timestamptz,
       '44444444-4444-4444-8444-444444444444'::uuid,
       '$NUTZER_OHNE_RECHTE'::uuid,
       10::integer
     ) as value"
  erwarte "$rolle" abgewiesen "alten ERPNext-Fahrzeugclaim ausfuehren" \
    "select public.claim_erpnext_booking_sync(
       '33333333-3333-4333-8333-333333333333'::uuid,
       now()::timestamptz,
       10::integer
     ) as value"
  erwarte "$rolle" abgewiesen "ERPNext-Kundenclaim mit Freigabe ausfuehren" \
    "select public.claim_erpnext_customer_booking_sync(
       '33333333-3333-4333-8333-333333333333'::uuid,
       now()::timestamptz,
       'angriff@example.invalid'::text,
       '44444444-4444-4444-8444-444444444444'::uuid,
       '$NUTZER_OHNE_RECHTE'::uuid,
       300::integer
     ) as value"
  erwarte "$rolle" abgewiesen "alten ERPNext-Kundenclaim ausfuehren" \
    "select public.claim_erpnext_customer_booking_sync(
       '33333333-3333-4333-8333-333333333333'::uuid,
       now()::timestamptz,
       'angriff@example.invalid'::text,
       300::integer
     ) as value"
done

echo ""
if [ "$fehler" -eq 0 ]; then
  echo "Alle $geprueft Zugriffsversuche verliefen wie erwartet."
  exit 0
fi
echo "$fehler von $geprueft Zugriffsversuchen verliefen ANDERS als erwartet." >&2
echo "Eine Regel wurde gelockert oder eine neue Tabelle hat keine." >&2
exit 1
