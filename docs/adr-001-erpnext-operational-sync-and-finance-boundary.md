# ADR-001: ERPNext operational synchronization and finance boundary

- Status: Accepted
- Date: 2026-08-26
- Decision owners: WHITE GLOSS operations and engineering

## Context

WHITE GLOSS currently accepts bookings through the public website and Supabase. ERPNext is being introduced as the internal operational workspace. Lexware remains the sole authoritative system for accounting, invoicing and financial records. A later bank connection may be evaluated separately, but no banking connector currently has authority. Without an explicit ownership and write boundary, the same customer, booking or financial event could be changed by more than one system, and an operational synchronization could accidentally create accounting or banking effects.

The production integration therefore needs a permanent control that allows a human administrator to approve one exact booking revision for one narrowly defined write scope without relying on a booking UUID stored in an environment variable.

## Decision

### System authority

| Data or process                                              | Authoritative system            | Boundary                                                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public booking intake                                        | Website and Supabase            | Supabase validates and stores the submitted booking.                                                                                                                          |
| Appointment date, public booking status and booking revision | Supabase                        | Every ERPNext approval is bound to the exact `bookings.updated_at` revision. A later booking change invalidates the approved snapshot.                                        |
| Customer and contact after a successful operational sync     | ERPNext                         | Supabase retains the source booking and the durable ERPNext mapping; operational maintenance takes place in ERPNext.                                                          |
| Customer vehicle after a successful operational sync         | ERPNext                         | The Supabase booking remains the source snapshot and stores the durable ERPNext vehicle mapping.                                                                              |
| Operational order and its workflow after a successful sync   | ERPNext                         | The Supabase booking UUID remains the permanent external idempotency key.                                                                                                     |
| Accounting, invoicing and all financial records              | Lexware                         | Lexware is the sole financial system of record. This operational integration does not create a second financial source in ERPNext.                                            |
| Possible future bank connectivity                            | Not authorized in this decision | ALYF/Frappe `Banking` via EBICS is only a candidate for later evaluation against a compatible existing bank account. It has no current authority and requires a separate ADR. |

Supabase does not become the operational back office, and ERPNext does not become the public booking intake system in this phase. Mapping records in Supabase connect the two authorities; they do not transfer financial authority to ERPNext.

### Operational write approvals

Permanent customer/contact and vehicle/order writes use database-backed approvals rather than exact-booking environment allowlists.

An approval:

- identifies one booking UUID, the exact booking revision and one scope (`customer` or `vehicle_order`);
- is created only for an authenticated application administrator;
- has a short expiry, with a maximum lifetime of five minutes;
- can be consumed exactly once;
- can be revoked or superseded before use;
- is stored in a server-only, RLS-protected database table;
- is consumed in the same database transaction that acquires the corresponding revision-locked processing claim.

The browser cannot turn a booking ID into an approval. A successful server-side preview produces a signed confirmation; the approval and the later commit are both checked against the current booking revision. A stale revision, wrong scope, expired/revoked approval, replay, non-admin caller or failed global switch denies the write before an ERPNext mutation.

The global server switches remain as emergency kill switches:

- `ERPNEXT_CUSTOMER_WRITE_ENABLED`
- `ERPNEXT_VEHICLE_ORDER_WRITES_ENABLED`

Both default to disabled. An approval cannot override a disabled switch, and an enabled switch does not authorize any booking without a valid unconsumed approval.

### Finance boundary

Lexware is the sole financial source of truth. Neither ERPNext nor ALYF/Frappe `Banking` is an accounting, payment or General Ledger authority under this decision.

This phase permits only the operational ERPNext objects already covered by their dedicated gates: Customer, Contact, `WHITE GLOSS Vehicle` and `WHITE GLOSS Order`. Approved non-stock service Items are managed by their existing fixed catalog gate.

The following writes are explicitly out of scope and must not be triggered directly or indirectly by the booking synchronization:

- Sales Invoice;
- Payment Entry;
- General Ledger or other accounting postings;
- stock, warehouse or inventory movements;
- bank accounts, bank transactions, reconciliation or bank-payment actions.

Payment information may be carried only as non-posting operational context when needed for the order verification. A successful synchronization must continue to report and verify that no financial document or posting was created.

ALYF/Frappe `Banking` is not installed, enabled or configured by this decision and is not part of the operational commit path. It remains only a possible future connector. Any later proposal requires its own ADR, compatibility check for the existing bank, credential handling, least-privilege design, reconciliation rules, test data and explicit production approval. Until such a decision explicitly replaces this boundary, it must not create ERPNext Payment Entry, Journal Entry, General Ledger or other financial writes.

## Alternatives considered

### Exact booking UUID in Edge Function secrets

Rejected as the permanent mechanism. It is difficult to audit, requires secret rotation for every booking and separates authorization from the exact database revision being written. The global boolean switches remain useful as kill switches, but booking authorization moves into the database.

### Broad automatic synchronization when the global switch is enabled

Rejected for the current phase. A single configuration error would authorize every eligible booking and would weaken review of uncertain external outcomes.

### ERPNext as the immediate accounting and banking authority

Rejected for this phase. Operational synchronization has been verified independently, while German accounting/e-invoice requirements, bank compatibility and reconciliation still require separate acceptance. Lexware therefore remains the sole financial system of record.

### A new bank provider as a prerequisite

Rejected. ALYF/Frappe `Banking` over EBICS is only a possible future connector to a compatible existing bank account, not an approved integration or a new financial authority. Provider replacement is considered only if the current bank cannot meet a later compatibility and security gate.

## Consequences

- Every production write needs a fresh preview and an explicit, auditable, single-use approval for one exact revision and scope.
- Customer synchronization and vehicle/order synchronization remain independently authorized.
- Failed or uncertain external writes do not regain authorization automatically; review and a new approval are required.
- The existing duplicate lookup, lease, fencing, mutation lock and post-write verification controls remain mandatory.
- Global switches provide a fast operational shutdown without deleting approval history.
- Lexware remains the only financial source of truth; the current ERPNext integration user receives no finance, banking or General Ledger permissions.
- Finance and bank capabilities can evolve later only through a separate accepted decision without widening the permissions of the current operational integration user.

## Rollback

Disable both global write switches to stop new operational commits immediately. Pending approvals may then be revoked or allowed to expire. The approval table and audit history can remain in place; removing the approval workflow is not required to restore a safe default-deny state. Existing Supabase bookings, ERPNext operational records and Lexware data remain untouched.

## Update 2026-09-06 — Invoicing authority

Lexware is **no longer** used for White Gloss customer invoices. Outgoing client invoices are created and finalized in **Qonto** (see `docs/superpowers/specs/2026-09-06-qonto-rechnungen-design.md`). ERPNext remains operational-only and must still not create Sales Invoice, Payment Entry, or GL postings. The earlier Lexware row in the authority table above is superseded for invoicing only.
