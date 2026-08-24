# WHITE GLOSS Frappe App Blueprint

Status: Gate 4 passed. The private Frappe bench is active, `white_gloss_os` is installed, and Gate 5 confirms that `WHITE GLOSS Vehicle` and `WHITE GLOSS Order` are readable with the required create/write permissions.

## Decision

The production model must be version-controlled in a dedicated Frappe app named `white_gloss_os`. Do not use ERPNext's standard fleet `Vehicle` DocType for customer vehicles. Do not create a temporary parallel order model in Supabase as the long-term source of truth.

The app targets Frappe/ERPNext v16 and is installed on the Frappe Cloud private bench. Operational vehicle/order writes remain default-deny until one exact booking is explicitly allowed by the server-side production-write gate.

## Module

- App: `white_gloss_os`
- Module: `White Gloss OS`
- Frappe dependency: `>=16.0.0,<17.0.0`
- ERPNext v16 required

## DocType: WHITE GLOSS Vehicle

Purpose: customer-owned vehicle master, separate from ERPNext fleet assets.

Suggested naming series: `WGV-.YYYY.-.#####`

Fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| customer | Link / Customer | yes | Current customer/owner relation |
| registration_plate | Data | no | Human-readable license plate |
| registration_plate_normalized | Data | no | Integration-normalized plate, indexed/unique when present |
| vin | Data | no | Vehicle identification number, unique when present |
| make | Data | no | Manufacturer |
| model | Data | no | Model |
| model_year | Int | no | Year |
| vehicle_class_id | Data | no | Existing website vehicle/category identifier |
| vehicle_class_label | Data | no | Human-readable snapshot |
| external_reference | Data | yes | Stable integration identity, unique |
| last_service_date | Date | no | Operational helper only |
| notes | Small Text | no | Internal notes |
| disabled | Check | no | Default 0 |

Identity rules:

1. VIN wins when present and verified.
2. Otherwise exact normalized plate may be used only when unambiguous.
3. Otherwise use the stable website/Supabase external vehicle key.
4. Never fuzzy-match by make/model/customer name.
5. Plate changes must not silently create a second vehicle when a stronger identity already exists.

## Child DocType: WHITE GLOSS Order Service

Purpose: immutable-ish service snapshot attached to an operational order.

Fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| item | Link / Item | yes | Must reference approved WHITE GLOSS service catalog |
| item_code_snapshot | Data | yes | Exact code at booking time |
| item_name_snapshot | Data | yes | Human-readable snapshot |
| service_kind | Select | yes | `package`, `addon`, `pickup`, `manual` |
| qty | Float | yes | Default 1 |
| rate_gross | Currency | no | Commercial snapshot only; no ledger effect |
| amount_gross | Currency | no | Commercial snapshot only |

## DocType: WHITE GLOSS Order

Purpose: operational detailing order. It is not an accounting document and must not post stock or GL entries.

Suggested naming series: `WGO-.YYYY.-.#####`

Fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| customer | Link / Customer | yes | ERPNext customer |
| vehicle | Link / WHITE GLOSS Vehicle | yes | Customer vehicle |
| booking_id | Data | yes | Supabase booking UUID, unique/idempotency key |
| source_reference | Data | no | Existing booking/invoice/reference number |
| status | Select | yes | Operational state machine |
| service_date | Date | yes | Website booking date |
| date_only | Check | yes | Default 1; exact handover/pickup time is not invented |
| handover_time | Time | no | Filled only after separately coordinated time exists |
| pickup_city | Data | no | Booking snapshot |
| preferred_contact | Data | no | Booking snapshot |
| booking_source | Data | no | Website/admin/etc. |
| services | Table / WHITE GLOSS Order Service | yes | Package/add-ons/pickup/manual services |
| agreed_gross_total | Currency | no | Snapshot; no ledger effect |
| sales_invoice | Link / Sales Invoice | no | Populated only after accounting gate is approved |
| payment_status | Select | no | Informational mirror only until payment integration is approved |
| internal_notes | Small Text | no | Internal operational notes |

## Order status state machine

Allowed operational states:

1. `Neue Buchung`
2. `Prüfung`
3. `Bestätigt`
4. `Fahrzeug angenommen`
5. `In Arbeit`
6. `Qualitätskontrolle`
7. `Fertig`
8. `Rechnung`
9. `Bezahlt`
10. `Abgeschlossen`
11. `Storniert`

Transitions should be validated server-side in the custom app. Financial state must not be inferred solely from an operational status string once ERPNext invoices/payments are connected.

## Roles and permissions

### WHITE GLOSS Integration

For `WHITE GLOSS Vehicle`, `WHITE GLOSS Order`, `WHITE GLOSS Order Service`:

- Read: yes
- Create: yes
- Write: yes
- Delete: no
- Submit/Cancel: no unless a later workflow explicitly requires it

The role must not gain System Manager or broad accounting permissions.

### System Manager

Full administrative access according to standard Frappe behavior.

Employee/customer roles will be designed later from least privilege.

## Integration/idempotency rules

- `booking_id` is the unique external idempotency key for an order.
- Vehicle lookup must use explicit identity rules; no fuzzy name matching.
- Before any create, perform an exact lookup.
- After any create, re-read and verify the persisted record.
- On timeout or HTTP 5xx after a write request, treat the outcome as uncertain; re-read before retrying.
- Never blindly replay a create after an uncertain response.
- No delete-on-error cleanup for records that may already be referenced.

## Service catalog dependency

Gate 4 established the fixed service codes. Order service rows must only use approved exact Item codes unless a future controlled manual-service workflow is explicitly added.

The current approved catalog is:

- `WG-PKG-BASIS`
- `WG-PKG-PREMIUM`
- `WG-PKG-KERAMIK`
- `WG-ADD-FELGEN`
- `WG-ADD-LEDER`
- `WG-ADD-MOTOR`
- `WG-ADD-OZON`
- `WG-ADD-SCHEINWERFER`
- `WG-ADD-HOLBRING`
- `WG-PICKUP-10KM`
- `WG-PICKUP-20KM`
- `WG-PICKUP-50KM`

## Deployment gate

The app installation, migration, permission readiness and mapping preview are complete. Do not enable vehicle/order commit mode for another booking until all are true:

1. `white_gloss_os` app exists in a dedicated Git repository.
2. Frappe Cloud private bench is available for the production site.
3. App is added to the private bench and installed on the site.
4. `bench migrate`/site migration completes successfully.
5. Gate 5 reports both custom DocTypes readable with create/write permissions.
6. A preview maps one confirmed booking to Customer + Vehicle + Order + service rows without writes.
7. One controlled write test is explicitly approved and its confirmation is bound to the current booking revision.
8. Re-run same booking and prove idempotency: exactly one vehicle identity and one order for the booking.
9. No Sales Invoice, Payment Entry, stock ledger, GL Entry or accounting changes occur during Gate 5.

Live Supabase state inspected on 2026-08-24 already contains one vehicle/order mapping from 2026-08-21. Any further write is a subsequent controlled production run and must use the exact-booking server allowlist; it must not be described as the first historical write.

## Frappe Cloud constraint

Public/shared benches cannot install arbitrary custom apps. WHITE GLOSS now uses the required private bench. Any later bench or billing change still requires explicit approval before execution.
