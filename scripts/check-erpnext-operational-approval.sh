#!/usr/bin/env bash
#
# Builds a disposable database, runs the ERPNext approval SQL contract and
# then releases two real PostgreSQL sessions against the same booking row.
# Exactly one contender may consume the approval and receive its fencing
# token; the other must get NULL.

set -euo pipefail

DB="${ERPNEXT_APPROVAL_CHECK_DB:-wg_erpnext_approval_check}"
WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v psql >/dev/null 2>&1 || {
  echo "psql nicht gefunden — dieser Test braucht einen PostgreSQL-Client." >&2
  exit 1
}

BLOCKER_LOG="$(mktemp)"
ERGEBNIS_EINS="$(mktemp)"
ERGEBNIS_ZWEI="$(mktemp)"
blocker_pid=""

aufraeumen() {
  if [ -n "$blocker_pid" ] && kill -0 "$blocker_pid" >/dev/null 2>&1; then
    kill "$blocker_pid" >/dev/null 2>&1 || true
    wait "$blocker_pid" >/dev/null 2>&1 || true
  fi
  rm -f "$BLOCKER_LOG" "$ERGEBNIS_EINS" "$ERGEBNIS_ZWEI"
  psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB WITH (FORCE);" >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

aufraeumen
psql -v ON_ERROR_STOP=1 -q -d postgres -c "CREATE DATABASE $DB;"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$WURZEL/supabase/test/supabase-shim.sql"
for datei in "$WURZEL"/supabase/migrations/*.sql; do
  PGOPTIONS="-c client_min_messages=warning" \
    psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$datei" >/dev/null
done

psql -v ON_ERROR_STOP=1 -q -d "$DB" \
  -f "$WURZEL/supabase/test/erpnext-operational-approval.sql"

RACE_BOOKING='20000000-0000-4000-8000-000000000006'
RACE_REVISION='2026-08-26 08:00:06+00'
ADMIN_ID='10000000-0000-4000-8000-000000000001'

# Hold the booking lock while both claim sessions are started. Releasing the
# blocker only after PostgreSQL reports both waiters makes this a real,
# deterministic two-session race rather than two likely-sequential retries.
PGAPPNAME='wg_approval_race_blocker' \
  psql -v ON_ERROR_STOP=1 -q -d "$DB" >"$BLOCKER_LOG" 2>&1 <<SQL &
begin;
select id from public.bookings where id = '$RACE_BOOKING'::uuid for update;
select pg_sleep(30);
commit;
SQL
blocker_pid=$!

blocker_bereit=0
for _ in $(seq 1 200); do
  if [ "$(psql -tA -d "$DB" -c "
    select count(*)
      from pg_stat_activity
     where application_name = 'wg_approval_race_blocker'
       and wait_event = 'PgSleep';
  ")" = "1" ]; then
    blocker_bereit=1
    break
  fi
  if ! kill -0 "$blocker_pid" >/dev/null 2>&1; then
    echo "Der Race-Blocker endete zu früh:" >&2
    sed -n '1,20p' "$BLOCKER_LOG" >&2
    exit 1
  fi
  sleep 0.05
done

if [ "$blocker_bereit" -ne 1 ]; then
  echo "Der Race-Blocker hat die Buchungszeile nicht rechtzeitig gesperrt." >&2
  exit 1
fi

CLAIM_SQL="
set role service_role;
select coalesce(
  public.claim_erpnext_booking_sync(
    '$RACE_BOOKING'::uuid,
    '$RACE_REVISION'::timestamptz,
    (
      select id
        from public.erpnext_write_approvals
       where booking_id = '$RACE_BOOKING'::uuid
         and scope = 'vehicle_order'
         and consumed_at is null
         and revoked_at is null
    ),
    '$ADMIN_ID'::uuid,
    10
  )::text,
  'NULL'
);"

PGAPPNAME='wg_approval_race_one' \
  psql -v ON_ERROR_STOP=1 -qAt -d "$DB" -c "$CLAIM_SQL" >"$ERGEBNIS_EINS" &
pid_eins=$!
PGAPPNAME='wg_approval_race_two' \
  psql -v ON_ERROR_STOP=1 -qAt -d "$DB" -c "$CLAIM_SQL" >"$ERGEBNIS_ZWEI" &
pid_zwei=$!

beide_warten=0
for _ in $(seq 1 200); do
  if [ "$(psql -tA -d "$DB" -c "
    select count(*)
      from pg_stat_activity
     where application_name in ('wg_approval_race_one', 'wg_approval_race_two')
       and wait_event_type = 'Lock';
  ")" = "2" ]; then
    beide_warten=1
    break
  fi
  sleep 0.05
done

if [ "$beide_warten" -ne 1 ]; then
  echo "Nicht beide Claim-Sitzungen warteten auf derselben Buchungszeile." >&2
  exit 1
fi

# Abort only the deliberately sleeping blocker. Its rollback releases the
# booking row atomically to the two contenders.
psql -v ON_ERROR_STOP=1 -q -d "$DB" -c "
  select pg_terminate_backend(pid)
    from pg_stat_activity
   where application_name = 'wg_approval_race_blocker';
" >/dev/null
wait "$blocker_pid" >/dev/null 2>&1 || true
blocker_pid=""

if ! wait "$pid_eins"; then
  echo "Erste Claim-Sitzung ist fehlgeschlagen." >&2
  exit 1
fi
if ! wait "$pid_zwei"; then
  echo "Zweite Claim-Sitzung ist fehlgeschlagen." >&2
  exit 1
fi

wert_eins="$(tr -d '\r\n ' <"$ERGEBNIS_EINS")"
wert_zwei="$(tr -d '\r\n ' <"$ERGEBNIS_ZWEI")"
uuid_regex='^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

if [[ "$wert_eins" =~ $uuid_regex ]] && [ "$wert_zwei" = "NULL" ]; then
  gewinner_token="$wert_eins"
elif [[ "$wert_zwei" =~ $uuid_regex ]] && [ "$wert_eins" = "NULL" ]; then
  gewinner_token="$wert_zwei"
else
  echo "Race lieferte nicht genau einen Token und einmal NULL: '$wert_eins' / '$wert_zwei'." >&2
  exit 1
fi

race_ok="$(psql -tA -d "$DB" -c "
  select (
    approval.consumed_at is not null
    and approval.consumed_by = '$ADMIN_ID'::uuid
    and approval.consumer = 'erpnext-vehicle-order-commit'
    and state.erpnext_processing_token = '$gewinner_token'::uuid
    and state.erpnext_attempts = 1
  )::text
    from public.erpnext_write_approvals approval
    join public.booking_automation_state state
      on state.booking_id = approval.booking_id
   where approval.booking_id = '$RACE_BOOKING'::uuid
     and approval.scope = 'vehicle_order';
")"

if [ "$race_ok" != "true" ]; then
  echo "Der Race-Gewinnertoken oder die einmalige Consumption wurde nicht korrekt gespeichert." >&2
  exit 1
fi

echo "ERPNext approval contract: SQL-Prüfung und Zwei-Sitzungs-Race bestanden."
