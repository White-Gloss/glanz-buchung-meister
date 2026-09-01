# WHITE GLOSS OS · ERPNext Gate Progress

Last verified: 2026-08-25

Approval architecture accepted: 2026-08-26

This file records verified integration gates. It does not replace `erpnext-domain-model.md` or [ADR-001](./adr-001-erpnext-operational-sync-and-finance-boundary.md).

## Gate 1 — expanded read probe

**PASS**

Verified reads:

- Company
- Customer
- Contact
- Address
- Item
- Customer Group
- Territory

Verified production identifiers:

- Company: `White-Gloss`
- Customer Group: `Individual`
- Territory: `All Territories`

## Gate 2 — customer write permission

**PASS**

The technical integration user was verified for create/write permission on:

- Customer
- Contact
- Address

No invoice, payment, bank, chart-of-accounts, user, role or system-settings write access was opened.

## Gate 3 — controlled customer test

**PASS**

A deliberately selected paid booking was used for the first controlled production write.

Verified result:

- exactly one ERPNext Customer created;
- exactly one ERPNext Contact created;
- Contact email matched uniquely;
- Contact linked to the expected Customer;
- Supabase customer mapping persisted immediately;
- processing lock released;
- synchronization timestamp persisted;
- no synchronization error persisted;
- no order, invoice, payment or accounting document created.

The permanent customer synchronization function remains default-deny. A new controlled run requires the global customer-write switch, a server-signed preview confirmation and a short-lived database approval bound to the exact booking revision and `customer` scope. The approval is consumed once in the same transaction as the fenced 15-minute database claim that blocks booking mutation during the ERPNext call. Customer and Contact POSTs additionally recheck current token ownership and lease expiry immediately before the external write. Before Customer creation, a durable uncertain-outcome marker blocks automatic retry across a hard worker exit; the marker is cleared only after the returned Customer ID is stored. Final success stores the booking-specific Customer mapping before publishing the shared mapping as synchronized. The controlled historical test did not enable broad automatic writes.

### Subsequent controlled customer synchronization — PASS

On 2026-08-25, the explicitly approved booking with service date 2026-08-29 passed the signed customer preview and revision-bound write gate.

Verified result:

- the preview reported that exactly one Customer and one Contact were needed;
- the Customer and Contact were created and mapped successfully;
- both returned identifiers were persisted before success;
- the shared customer mapping and booking-specific customer state are synchronized;
- the customer lease and fencing tokens were released;
- no customer synchronization error remains.

No booking remains automatically authorized. Exact booking UUID environment allowlists are replaced by auditable, revision- and scope-bound, single-use database approvals. The global switch remains the emergency kill switch, and the permanent customer endpoint remains default-deny.

## Gate 4 — service catalog

**PASS**

The approved package, add-on and pickup Items exist under stable exact item codes. They are enabled, valid sales items and non-stock items. Vehicle classes remain pricing multipliers and are not sales items.

Verified behavior:

- exact-code lookup only;
- duplicate-safe verification;
- no Item creation during booking preview or order commit;
- no vehicle class is written as a service Item.

## Gate 5 — vehicle and operational order

**PASS**

Verified current state:

- private Frappe bench is active;
- `white_gloss_os` is installed;
- `WHITE GLOSS Vehicle` is readable and has the required create/write permissions;
- `WHITE GLOSS Order` is readable and has the required create/write permissions;
- a selected booking maps cleanly to the existing ERPNext customer, deterministic vehicle identity, operational order and exact service rows;
- preview mode performs no writes.

Live Supabase state inspected on 2026-08-24 already contained one vehicle/order mapping synchronized on 2026-08-21. The controlled run below was therefore a subsequent production write, not the first historical vehicle/order write.

### Controlled subsequent vehicle/order production run — PASS

On 2026-08-25, the same explicitly approved booking with service date 2026-08-29 completed the signed preview, revision-locked claim, create and post-write verification sequence.

Verified result:

- `WHITE GLOSS Vehicle` `WGV-2026-00003` was created;
- `WHITE GLOSS Order` `WGO-2026-00004` was created;
- the exact service set is `WG-PKG-KERAMIK`, `WG-ADD-HOLBRING` and `WG-ADD-SCHEINWERFER`;
- all 18 vehicle, customer, booking, service, date, total and payment checks passed;
- exact-plate vehicle count is one and exact-booking order count is one;
- no Sales Invoice is linked and the commit reported `financial_writes=false`;
- Supabase contains one booking-state row with the expected vehicle and order identifiers;
- all processing leases and fencing tokens were released;
- customer and vehicle/order error totals remain zero.

After verification, the customer, preview and commit Functions were restored byte-for-byte to current `main`. The short-lived runner was retired and contains no booking UUID, service-role logic or run token.

The permanent commit endpoint is default-deny. A write requires all of the following at the same time:

1. valid Supabase user session;
2. application `admin` role;
3. server switch `ERPNEXT_VEHICLE_ORDER_WRITES_ENABLED=true`;
4. an active database approval for that booking, its current `updated_at` revision and `vehicle_order` scope;
5. a server-signed preview confirmation with a five-minute lifetime, bound to the booking, revision and approval identifier;
6. atomic single-use approval consumption together with the revision-locked Supabase claim;
7. duplicate-safe ERPNext lookups;
8. immediate full re-read and verification of vehicle, order and service snapshots after any create;
9. a confirmed Supabase state update before success is returned.

The server switch remains disabled until operational writes are intentionally enabled. An enabled switch alone authorizes nothing, and an approval cannot override a disabled switch. Financial documents remain outside this phase.

The preview confirmation is HMAC-signed with a server-only key, carries a cryptographic nonce and expires after five minutes; it cannot be constructed from browser-visible booking data. The claim locks the approval and booking rows, verifies the approved `bookings.updated_at` value and consumes the approval in the same transaction. A database trigger blocks booking updates and deletion until the ERPNext commit succeeds, records a reviewable failure or its 15-minute crash-recovery lease expires. Together these controls prevent a bypassed preview, approval replay or stale approved snapshot from reaching the vehicle/order write calls without leaving a crashed worker able to lock a booking permanently.

## Finance and banking boundary

**OUT OF SCOPE FOR THE CURRENT OPERATIONAL GATES**

The customer and vehicle/order paths must not create or update Sales Invoice, Payment Entry, General Ledger, stock/warehouse or bank records. Lexware remains the current accounting and invoice fallback. The planned future bank integration is the ALYF/Frappe `Banking` app via EBICS to a compatible existing bank account; it is not a new bank selection and requires its own later security, reconciliation and production-write gate.
