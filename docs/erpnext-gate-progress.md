# WHITE GLOSS OS · ERPNext Gate Progress

Last verified: 2026-08-24

This file records verified integration gates. It does not replace `erpnext-domain-model.md`.

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

The permanent customer synchronization function remains default-deny. A new controlled run requires the customer-write switch, an exact one-booking allowlist, a server-signed five-minute preview confirmation bound to the booking revision and a fenced database claim that blocks booking mutation during the ERPNext call. The controlled historical test did not enable broad automatic writes.

### Next customer prerequisite

The live audit on 2026-08-24 found 14 bookings without a confirmed ERPNext customer mapping. A new vehicle/order production test must first take exactly one eligible booking through the controlled customer preview and customer-write gate. No booking is automatically allowlisted.

## Gate 4 — service catalog

**PASS**

The approved package, add-on and pickup Items exist under stable exact item codes. They are enabled, valid sales items and non-stock items. Vehicle classes remain pricing multipliers and are not sales items.

Verified behavior:

- exact-code lookup only;
- duplicate-safe verification;
- no Item creation during booking preview or order commit;
- no vehicle class is written as a service Item.

## Gate 5 — vehicle and operational order

**READINESS PASS · MAPPING PREVIEW PASS · NEXT PRODUCTION WRITE LOCKED**

Verified current state:

- private Frappe bench is active;
- `white_gloss_os` is installed;
- `WHITE GLOSS Vehicle` is readable and has the required create/write permissions;
- `WHITE GLOSS Order` is readable and has the required create/write permissions;
- a selected booking maps cleanly to the existing ERPNext customer, deterministic vehicle identity, operational order and exact service rows;
- preview mode performs no writes.

Live Supabase state inspected on 2026-08-24 already contains one vehicle/order mapping synchronized on 2026-08-21. The next controlled run is therefore not the first historical vehicle/order production write. This discrepancy must remain visible in the project record.

The permanent commit endpoint is default-deny. A write requires all of the following at the same time:

1. valid Supabase user session;
2. application `admin` role;
3. server switch `ERPNEXT_VEHICLE_ORDER_WRITES_ENABLED=true`;
4. exact one-booking allowlist in `ERPNEXT_VEHICLE_ORDER_APPROVED_BOOKING_ID`;
5. a server-signed preview confirmation with a five-minute lifetime, bound to that booking ID and its current `updated_at` revision;
6. duplicate-safe ERPNext lookups and the revision-locked atomic Supabase claim;
7. immediate full re-read and verification of vehicle, order and service snapshots after any create;
8. a confirmed Supabase state update before success is returned.

The server switch and booking allowlist remain unset until explicit approval. Financial documents remain outside this phase.

The preview confirmation is HMAC-signed with a server-only key, carries a cryptographic nonce and expires after five minutes; it cannot be constructed from browser-visible booking data. The claim then verifies the approved `bookings.updated_at` value while holding a row lock. A database trigger blocks booking updates and deletion until the ERPNext commit succeeds, records a reviewable failure or its 15-minute crash-recovery lease expires. Together these controls prevent a bypassed preview or stale approved snapshot from reaching the vehicle/order write calls without leaving a crashed worker able to lock a booking permanently.

