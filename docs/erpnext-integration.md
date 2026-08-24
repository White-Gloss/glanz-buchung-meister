# WHITE GLOSS OS · ERPNext Integration

Status: connectivity, service catalog and vehicle/order readiness passed; permanent production writes remain default-deny

## Scope

ERPNext/Frappe v16 at `https://white-gloss-os.f.frappe.cloud` is the target system of record for the operational WHITE GLOSS OS. The existing website and Supabase booking database remain the public intake layer during migration.

The first integration phase is deliberately narrow:

1. prove authenticated connectivity from Supabase Edge Functions to ERPNext;
2. persist ERPNext sync state next to the existing booking automation state;
3. introduce idempotent claiming and failure handling;
4. only after a read/write permission probe succeeds, synchronize customer and order data;
5. keep Lexware running as the invoice fallback until German accounting/e-invoice compatibility is validated independently.

## Verified ERPNext identifiers

- Site: `https://white-gloss-os.f.frappe.cloud`
- Company record: `White-Gloss`
- Customer Group default: `Individual`
- Territory default: `All Territories`

The public brand remains WHITE GLOSS. Integration code must use ERPNext's exact internal Company name where an ERPNext document requires it.

## Secrets

The following values are Supabase Edge Function secrets and must never be committed to Git or exposed to browser code:

- `ERPNEXT_BASE_URL`
- `ERPNEXT_API_KEY`
- `ERPNEXT_API_SECRET`
- optional `ERPNEXT_COMPANY` override; current safe default in the preview worker is `White-Gloss`
- `ERPNEXT_VEHICLE_ORDER_WRITES_ENABLED`; must be exactly `true` for any permanent vehicle/order write
- `ERPNEXT_VEHICLE_ORDER_APPROVED_BOOKING_ID`; exact UUID of the one explicitly approved booking

The two vehicle/order gate values must remain unset or disabled during normal preview work. Enabling the switch without the exact booking allowlist does not permit a write, and allowing a booking while the switch is disabled does not permit a write.

The tracked `.env` file must never receive ERPNext credentials.

## Authentication model

ERPNext requests use Frappe token authentication:

`Authorization: token <api-key>:<api-secret>`

The credentials belong to the dedicated technical ERPNext user. The integration user must follow least privilege and must not be Administrator/System Manager.

Supabase Edge Functions use platform JWT verification and independently verify the caller's Supabase session plus application `admin` role before exposing ERPNext diagnostics or sync actions. Browser preflight requests are supported, but authentication and authorization remain mandatory for the actual request.

## Current database state

`public.booking_automation_state` contains additive ERPNext fields:

- `erpnext_customer_id`
- `erpnext_vehicle_id`
- `erpnext_order_id`
- `erpnext_processing_at`
- `erpnext_synced_at`
- `erpnext_last_error`
- `erpnext_last_http_status`
- `erpnext_attempts`

`erpnext_order_id` is unique when present.

A live-state audit on 2026-08-24 found one existing vehicle/order mapping synchronized on 2026-08-21. The next controlled operation is therefore a subsequent production run, not the first historical vehicle/order write.

The function `public.claim_erpnext_booking_sync(uuid, integer)` atomically claims a booking for one sync worker. It is executable only by `service_role`.

A failed ERPNext write is intentionally not retried automatically while `erpnext_last_error` is set. This protects against duplicate external documents when an upstream POST may have succeeded but its response was lost.

## Idempotency strategy

Before any external create operation the worker searches ERPNext for an existing deterministic identity. `WHITE GLOSS Order.booking_id` uses the Supabase booking UUID as the permanent unique idempotency key. Vehicle matching uses the exact normalized registration plate until a stronger VIN or stable external vehicle identity is available.

The synchronization sequence is:

1. read booking from Supabase;
2. atomically claim sync state;
3. look for an existing ERPNext customer mapping;
4. look for an existing ERPNext order by external reference;
5. create only missing records;
6. write returned ERPNext IDs to `booking_automation_state`;
7. clear processing state and record `erpnext_synced_at`;
8. on uncertain failure, store a sanitized error and stop automatic retry.

## Appointment rule

Website appointments are date-based. Exact handover/pickup times are coordinated personally a few days before the appointment. The ERPNext integration must preserve this distinction and must not invent fixed customer appointment times.

## Two-gate change process

### Gate A · before a change

For each production change record:

- intended behavior;
- data affected;
- permissions required;
- rollback route;
- test case;
- duplicate/retry failure mode.

### Gate B · after a change

Verify:

- expected result;
- automated/manual test result;
- logs contain no secrets;
- no duplicate/lost records;
- security advisors;
- performance advisors where relevant;
- rollback remains possible.

## Current gates

### Connectivity — PASS

Deployed Edge Function: `erpnext-healthcheck`

Verified on 2026-08-20:

- Supabase admin session accepted;
- ERPNext token authentication accepted;
- upstream ERPNext status `200`;
- Company `White-Gloss` found;
- Customer Group `Individual` found;
- Territory `All Territories` found;
- health state recorded `stage=complete`, `ok=true`, `permissions_ready=true`, `detail=readiness_checks_passed`.

The function:

- requires a valid Supabase JWT;
- additionally requires application `admin` role;
- reads ERPNext credentials only from server-side Edge Function secrets;
- calls `frappe.auth.get_logged_user`;
- rejects redirects/HTML as successful authentication;
- returns only safe status information;
- never returns or logs the API key/secret;
- supports browser CORS preflight;
- uses an 8 second timeout;
- sends `Cache-Control: no-store`.

Protected admin diagnostics route: `/admin/erpnext`.

### Sync preview — NO WRITES

Edge Function: `erpnext-sync-booking`

Properties:

- requires Supabase JWT and application `admin` role;
- loads the selected booking server-side;
- confirms ERPNext returned authenticated JSON rather than merely checking HTTP 200;
- rejects redirects and invalid/non-JSON upstream responses;
- read-probes Company, Customer, Contact, Address, Item, Customer Group and Territory;
- returns a customer/vehicle/order mapping preview only;
- uses exact ERPNext Company `White-Gloss` in the order mapping;
- preserves date-only customer appointments;
- `mode: commit` is hard-disabled with HTTP 409;
- does not create or update any ERPNext document yet.

### Vehicle/order readiness and mapping preview — PASS, NO WRITES

Edge Functions:

- `erpnext-vehicle-order-readiness`
- `erpnext-vehicle-order-preview`

Verified behavior:

- both custom DocTypes are readable with create/write permission;
- exact customer mapping is required;
- exact normalized vehicle plate is required and conflicts stop processing;
- package/add-on Items are revalidated by exact code;
- booking UUID maps to `WHITE GLOSS Order.booking_id`;
- customer appointment remains date-only and no handover time is invented;
- preview returns the complete Customer → Vehicle → Order → services payload without writes.

### Vehicle/order commit — DEFAULT-DENY

Edge Function: `erpnext-vehicle-order-commit`

A permanent call is rejected unless the authenticated admin request also passes the server switch, the exact one-booking allowlist and the preview-derived confirmation bound to both booking UUID and current `bookings.updated_at` revision. Any booking change invalidates the prior preview confirmation. The function then performs duplicate-safe lookups, claims the booking atomically, creates only missing operational records, re-reads the complete vehicle/order/service state immediately and reports success only after the Supabase mapping update is confirmed.

The admin page has one write path only: a successful fresh preview. The previous separate direct commit card is no longer rendered.

### Database security hardening

Direct RPC execution of `public.reject_duplicate_booking_submission()` was revoked from `public`, `anon`, and `authenticated`. The function is a trigger function; its booking trigger remains enabled on `public.bookings` while the exposed RPC attack surface is removed.

Privilege verification shows only `postgres` and `service_role` retain EXECUTE for both the duplicate-booking trigger function and the ERPNext sync-claim function.

The atomic claim was tested inside a rolled-back transaction against an existing booking:

- first claim: `true`;
- immediate second claim: `false`;
- post-rollback rows with ERPNext processing state: `0`.

This confirms mutual exclusion without altering production booking state.

The remaining Supabase security advisor items are intentionally tracked:

- `booking_automation_state`: RLS enabled with no public policies because it is server-only state;
- `condition_reports`: RLS/policy intent must be reviewed before changing behavior;
- leaked-password protection must be enabled in Supabase Auth settings.

Unused-index notices are not being acted on while the production dataset is small; index usage statistics are not yet representative.

## ERPNext write prerequisites and continuing constraints

The foundational prerequisites below have passed. They remain regression constraints for every controlled run:

- connectivity gate remains green;
- integration user can read Customer, Contact, Address and Item;
- integration user has only the required create/write permissions for Customer, Contact and Address;
- service Items for detailing packages/add-ons are defined;
- the phase-1 customer vehicle is represented by `WHITE GLOSS Vehicle`;
- order external-reference mapping is confirmed;
- a controlled operational order can be created without generating a financial document;
- every controlled run is followed by an idempotent re-read proving one vehicle identity and exactly one ERPNext order for the booking.

Sales Invoice, Payment Entry, bank, chart of accounts, User, Role and System Settings remain outside this integration phase.

## Rollback

The current Supabase changes are additive. Rollback consists of:

- disabling/removing the Edge Functions from callers;
- dropping the ERPNext sync columns/index and claim function if necessary;
- leaving existing website bookings and Lexware state untouched.

No current migration rewrites customer or booking data.
