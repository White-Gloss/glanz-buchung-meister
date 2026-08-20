# WHITE GLOSS OS · ERPNext Gate Progress

Last verified: 2026-08-20

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

The permanent customer synchronization function remains feature-gated for commit mode. The controlled test did not enable broad automatic writes.

## Gate 4 — service catalog

**IN PROGRESS**

The approved catalog contains stable ERPNext item codes for packages, add-ons and pickup tiers. Vehicle classes remain pricing multipliers and must not become sales items.

Current work:

- preview-only service catalog readiness function;
- exact-code lookup only;
- duplicate-safe verification;
- Item create/write permission probe;
- no Item writes in the readiness check.

Gate 4 is complete only after all approved service items are present, enabled, valid sales items and verified by exact item code.

## Gate 5 — vehicle and operational order

**BLOCKED BY DESIGN UNTIL GATE 4 PASSES**

Do not create ERPNext fleet `Vehicle` records as a shortcut. Customer cars require the planned `WHITE GLOSS Vehicle` model. Booking-to-order creation remains disabled until the custom vehicle/order model exists and has its own idempotency and permission gates.

Financial documents remain outside this phase.
