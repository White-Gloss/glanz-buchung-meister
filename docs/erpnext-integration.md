# WHITE GLOSS OS · ERPNext Integration

Status: controlled customer/contact and vehicle/order production verification passed; permanent operational writes use single-use approvals and remain default-deny

## Scope

ERPNext/Frappe v16 at `https://white-gloss-os.f.frappe.cloud` is the target system of record for the operational WHITE GLOSS OS. The existing website and Supabase booking database remain the public intake layer during migration.

The first integration phase is deliberately narrow:

1. prove authenticated connectivity from Supabase Edge Functions to ERPNext;
2. persist ERPNext sync state next to the existing booking automation state;
3. introduce idempotent claiming and failure handling;
4. only after a read/write permission probe succeeds, synchronize customer and order data;
5. keep Lexware running as the accounting and invoice fallback until German accounting/e-invoice compatibility is validated independently;
6. keep invoice, payment, ledger, stock and banking effects outside the operational synchronization.

The accepted ownership and finance boundary is recorded in [ADR-001](./adr-001-erpnext-operational-sync-and-finance-boundary.md). Supabase remains authoritative for public intake, appointment scheduling and the booking revision. After a successful synchronization, ERPNext is authoritative for the operational Customer, Contact, `WHITE GLOSS Vehicle` and `WHITE GLOSS Order`. Lexware remains the current financial fallback.

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
- `ERPNEXT_CUSTOMER_WRITE_ENABLED`; must be exactly `true` for any permanent customer/contact write
- `ERPNEXT_VEHICLE_ORDER_WRITES_ENABLED`; must be exactly `true` for any permanent vehicle/order write

The switches are independent emergency kill switches and default to disabled. Booking authorization is not stored in Edge Function secrets. It is represented by a short-lived, database-backed approval bound to one booking UUID, its exact `bookings.updated_at` revision and one scope (`customer` or `vehicle_order`). Enabling a switch without a valid, unconsumed approval does not permit a write, and an approval cannot override a disabled switch.

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
- `erpnext_processing_expires_at`
- `erpnext_customer_processing_at`
- `erpnext_customer_processing_expires_at`
- `erpnext_customer_processing_token`
- `erpnext_synced_at`
- `erpnext_last_error`
- `erpnext_last_http_status`
- `erpnext_attempts`

`erpnext_order_id` is unique when present.

`public.erpnext_write_approvals` records the permanent operational approval boundary. Direct browser roles cannot read or mutate this table. An authenticated application administrator may request an approval only through the server-side approval function after a fresh signed preview. An approval expires within five minutes, is revision- and scope-bound, and is consumed exactly once in the same transaction that acquires the processing claim. A later booking revision, replay, expiry, revocation or wrong scope fails closed.

A live-state audit on 2026-08-25 found two fully synchronized customer mappings and two fully synchronized vehicle/order mappings, including the controlled production run for the booking with service date 2026-08-29. The earlier mapping synchronized on 2026-08-21 remains recorded, so the 2026-08-25 operation was a subsequent production run, not the first historical vehicle/order write.

The approval-aware `public.claim_erpnext_booking_sync(...)` function atomically consumes one exact vehicle/order approval and claims the same booking revision for a sync worker. The corresponding customer claim consumes a `customer` approval while acquiring its fenced mapping and booking leases. Both functions are executable only by `service_role`. They lock the booking and approval rows while comparing `bookings.updated_at`; a database trigger blocks booking updates and deletion until the worker clears the processing lease after success or a reviewable failure. The vehicle/order worker uses a 15-minute lease, which also releases the mutation guard automatically after a hard worker exit. Legacy approval-free claim signatures fail closed.

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

### Customer commit — SINGLE-USE, DEFAULT-DENY

Edge Function: `erpnext-sync-customer`

A permanent customer/contact synchronization requires an authenticated admin request, `ERPNEXT_CUSTOMER_WRITE_ENABLED=true`, a fresh server-signed preview and an active database approval for the exact booking UUID, current `bookings.updated_at` revision and `customer` scope. The approval has a maximum five-minute lifetime and is consumed exactly once in the same transaction as the database claim. The claim rechecks the revision under a row lock, fences the mapping and 15-minute booking lease with one token and blocks booking updates or deletion during the external ERPNext write window. Immediately before every ERPNext Customer or Contact POST, the function rechecks that both fencing tokens still belong to the worker and that the booking lease has not expired.

Before the non-idempotent Customer POST, the worker durably records `uncertain_customer_create_started` and then checks the lease again. If the worker exits after ERPNext accepts the request but before the returned Customer ID is stored, the marker blocks automatic retry and forces manual reconciliation instead of risking a duplicate Customer. Once the Customer ID is durable, the marker is cleared and safe Contact recovery may continue. Completion persists the booking-specific Customer ID before publishing the shared customer mapping as synchronized, so a failed booking-state update cannot leave a false `already_synced` state.

The Admin UI exposes the commit action only from a successful fresh preview. Customer, contact and mapping writes remain independently gated from vehicle/order writes.

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

### Vehicle/order commit — SINGLE-USE, DEFAULT-DENY

Edge Function: `erpnext-vehicle-order-commit`

A permanent call is rejected unless the authenticated admin request also passes the global server switch, a server-signed preview confirmation and an active database approval bound to the exact booking UUID, current `bookings.updated_at` revision and `vehicle_order` scope. The signed confirmation contains a cryptographic nonce, is bound to the approval identifier and expires after five minutes; browser-visible booking data is insufficient to forge it. The approval is consumed atomically with the revision-locked claim and cannot be replayed. Any booking change invalidates it. The function then performs duplicate-safe lookups, blocks concurrent booking changes for the short external commit window, creates only missing operational records, re-reads the complete vehicle/order/service state immediately and reports success only after the Supabase mapping update is confirmed.

The admin page has one write path only: a successful fresh preview. The previous separate direct commit card is no longer rendered.

### Controlled end-to-end production verification — PASS

On 2026-08-25, one explicitly approved booking with service date 2026-08-29 passed the complete customer/contact and vehicle/order sequence.

Verified result:

- the signed customer preview was bound to the current booking revision;
- one Customer and one linked Contact were synchronized;
- `WHITE GLOSS Vehicle` `WGV-2026-00003` and `WHITE GLOSS Order` `WGO-2026-00004` were created;
- the order contains exactly `WG-PKG-KERAMIK`, `WG-ADD-HOLBRING` and `WG-ADD-SCHEINWERFER`;
- all 18 post-write checks passed;
- exact identity re-reads returned one vehicle and one order;
- `financial_writes=false` and `sales_invoice=null`;
- Supabase records HTTP 200, synchronized timestamps, no errors and no active leases.

The temporary execution window was bound to the exact booking and had an automatic expiry. Immediately after verification, all three write-path Functions were restored byte-for-byte to current `main`; their normal server-secret gates remain default-deny. The short-lived runner and diagnostic endpoints now return `410` and contain no booking UUID, service-role logic or run token.

### Database security hardening

Direct RPC execution of `public.reject_duplicate_booking_submission()` was revoked from `public`, `anon`, and `authenticated`. The function is a trigger function; its booking trigger remains enabled on `public.bookings` while the exposed RPC attack surface is removed.

Privilege verification shows only `postgres` and `service_role` retain EXECUTE for both the duplicate-booking trigger function and the ERPNext sync-claim function.

The atomic claim was tested inside a rolled-back transaction against an existing booking:

- first claim: `true`;
- immediate second claim: `false`;
- post-rollback rows with ERPNext processing state: `0`.

This confirms mutual exclusion without altering production booking state.

The revision-aware vehicle/order claim rejects a stale `updated_at` value before existing-pair reconciliation or any external create. The customer claim independently binds the exact booking revision to the normalized-email mapping and assigns the same unguessable fencing token to both leases. While either lease is active, the booking-mutation trigger rejects concurrent edits and deletion; token-matched cleanup releases that protection immediately, and lease expiry provides bounded crash recovery.

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

Sales Invoice, Payment Entry, General Ledger, stock/warehouse movement, bank writes, chart of accounts, User, Role and System Settings remain outside this integration phase. Lexware remains the current accounting and invoice fallback. A future bank connection uses the ALYF/Frappe `Banking` app via EBICS to a compatible existing bank and must pass a separate security, reconciliation and production-write gate; it is not part of the current booking commit.

## Rollback

The current Supabase changes are additive. Rollback consists of:

- disabling/removing the Edge Functions from callers;
- revoking pending approvals or allowing them to expire;
- dropping the ERPNext sync columns/index, approval table and claim functions if necessary;
- leaving existing website bookings and Lexware state untouched.

No current migration rewrites customer or booking data.
