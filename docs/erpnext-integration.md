# WHITE GLOSS OS · ERPNext Integration

Status: connectivity gate passed; sync remains preview-only

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

The tracked `.env` file must never receive ERPNext credentials.

## Authentication model

ERPNext requests use Frappe token authentication:

`Authorization: token <api-key>:<api-secret>`

The credentials belong to the dedicated technical ERPNext user. The integration user must follow least privilege and must not be Administrator/System Manager.

Supabase Edge Functions use platform JWT verification and independently verify the caller's Supabase session plus application `admin` role before exposing ERPNext diagnostics or sync actions. Browser preflight requests are supported, but authentication and authorization remain mandatory for the actual request.

## Current database state

`public.booking_automation_state` contains additive ERPNext fields:

- `erpnext_customer_id`
- `erpnext_order_id`
- `erpnext_processing_at`
- `erpnext_synced_at`
- `erpnext_last_error`
- `erpnext_last_http_status`
- `erpnext_attempts`

`erpnext_order_id` is unique when present.

The function `public.claim_erpnext_booking_sync(uuid, integer)` atomically claims a booking for one sync worker. It is executable only by `service_role`.

A failed ERPNext write is intentionally not retried automatically while `erpnext_last_error` is set. This protects against duplicate external documents when an upstream POST may have succeeded but its response was lost.

## Idempotency strategy

Before any external create operation the worker must search ERPNext for an existing external reference. During the first phase the Supabase booking `invoice_number` is used as a stable external order reference. When the custom WHITE GLOSS Frappe app is available, this will be replaced by a dedicated unique `external_booking_id` field.

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

## ERPNext write prerequisites

Do not enable customer/order creation until all of the following pass:

- connectivity gate remains green;
- integration user can read Customer, Contact, Address and Item;
- integration user has only the required create/write permissions for Customer, Contact and Address;
- service Items for detailing packages/add-ons are defined;
- vehicle representation for phase 1 is explicitly chosen;
- order external-reference mapping is confirmed;
- a controlled test booking can be created without generating a financial document;
- retry simulation proves that the same booking creates exactly one ERPNext order.

Sales Invoice, Payment Entry, bank, chart of accounts, User, Role and System Settings remain outside this integration phase.

## Rollback

The current Supabase changes are additive. Rollback consists of:

- disabling/removing the Edge Functions from callers;
- dropping the ERPNext sync columns/index and claim function if necessary;
- leaving existing website bookings and Lexware state untouched.

No current migration rewrites customer or booking data.
