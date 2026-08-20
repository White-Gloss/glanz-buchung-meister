# WHITE GLOSS OS · ERPNext Domain Model

Status: approved design baseline for the next integration gate

## Goal

ERPNext becomes the operational system of record while the website and Supabase remain the public intake and synchronization layer during migration.

The next phase must not create invoices or payments. It is limited to customer, contact, address, service catalog and order-domain preparation.

## Verified production identifiers

- ERPNext site: `https://white-gloss-os.f.frappe.cloud`
- ERPNext Company: `White-Gloss`
- Customer Group: `Individual`
- Territory: `All Territories`

The public brand remains WHITE GLOSS. Integration code must use ERPNext's exact internal Company name only where the ERPNext API requires it.

## Customer model

### ERPNext Customer

One ERPNext Customer represents one customer account.

Initial matching order:

1. exact normalized email;
2. existing persisted ERPNext mapping in `booking_automation_state`;
3. no automatic fuzzy-name matching.

This deliberately avoids accidental customer merges.

### Contact

A Contact stores email and phone data and is linked to the Customer. Existing contact records should be reused only after deterministic matching.

### Address

Address records are created only when a real postal address is available. `pickup_city` is not sufficient to invent a customer address.

## Vehicle model

Do not use ERPNext's standard fleet `Vehicle` model for customer cars. That model is intended for vehicles operated by the company and would mix customer assets with the company's own fleet semantics.

Target model for the custom WHITE GLOSS app: `WHITE GLOSS Vehicle`.

Planned fields:

- customer (Link → Customer)
- make
- model
- license_plate
- vin
- color
- first_registration
- mileage
- vehicle_class
- internal_notes
- external_source
- external_vehicle_id
- last_service_date

Until the custom DocType is deployed, the website/Supabase booking remains authoritative for the vehicle details and the plate/category may be carried in the order mapping. No fake ERPNext fleet vehicle is created as an interim shortcut.

## Order model

Target custom operational record: `WHITE GLOSS Order` in the later custom Frappe app.

Pipeline:

`Neue Buchung → Prüfung → Bestätigt → Fahrzeug angenommen → In Arbeit → Qualitätskontrolle → Fertig → Rechnung → Bezahlt → Abgeschlossen`

Required fields include:

- external_booking_id (unique UUID from Supabase)
- external_reference / website invoice number
- customer
- vehicle
- service_date
- optional exact handover time
- package
- add-ons
- agreed gross price
- deposit state
- booking source
- preferred contact channel
- assigned employee
- before/damage/after photos
- internal notes

Customer website appointments remain date-based until an exact handover/pickup time is personally agreed. The integration must never invent a time.

## Service catalog

Current Supabase service catalog is mapped to stable planned ERPNext item codes.

### Packages

| Source ID | Label | Planned ERPNext Item Code |
|---|---|---|
| `basis` | Basis Pflege | `WG-PKG-BASIS` |
| `premium` | Premium Glanz | `WG-PKG-PREMIUM` |
| `keramik` | High-End Keramik | `WG-PKG-KERAMIK` |

### Add-ons

| Source ID | Label | Planned ERPNext Item Code |
|---|---|---|
| `felgen` | Felgen-Spezial | `WG-ADD-FELGEN` |
| `leder` | Lederpflege Deluxe | `WG-ADD-LEDER` |
| `motor` | Motorwäsche | `WG-ADD-MOTOR` |
| `ozon` | Innenraum-Ozon | `WG-ADD-OZON` |
| `scheinwerfer` | Scheinwerfer-Aufbereitung | `WG-ADD-SCHEINWERFER` |
| `hol` | Hol- & Bringservice | `WG-ADD-HOLBRING` |

### Pickup tiers

| Source ID | Label | Planned ERPNext Item Code |
|---|---|---|
| `tier_10` | Abholung bis 10 km | `WG-PICKUP-10KM` |
| `tier_20` | Abholung bis 20 km | `WG-PICKUP-20KM` |
| `tier_50` | Abholung bis 50 km | `WG-PICKUP-50KM` |

### Vehicle classes

`kompakt`, `suv` and `transporter` are pricing multipliers, not sellable services. They must not become normal ERPNext sales items. They belong in the WHITE GLOSS pricing/domain layer.

## Idempotency

The permanent unique synchronization key is the Supabase booking UUID (`external_booking_id`).

Until the custom field exists in ERPNext, the existing website invoice number may be used as an interim external reference, but it must not replace the UUID in the long-term domain model.

Rules:

1. search for an existing mapping before every create;
2. never fuzzy-match orders;
3. after an uncertain POST result, stop automatic retries;
4. persist the returned ERPNext ID immediately after a confirmed create;
5. replaying the same booking must produce one customer mapping and one operational order.

## Permission boundary

Technical integration user may eventually receive:

- Customer: read/create/write
- Contact: read/create/write
- Address: read/create/write
- Task/Event/Communication/File: read/create/write as needed
- Company: read only
- Item / Item Price: read only during initial synchronization

Still forbidden in this phase:

- Sales Invoice write
- Payment Entry write
- bank access
- Chart of Accounts write
- User / Role administration
- System Settings write
- delete permissions for synchronized customer records

## Next gates

### Gate 1 — expanded read probe

Verify the technical ERPNext user can read:

- Company
- Customer
- Contact
- Address
- Item
- Customer Group
- Territory

### Gate 2 — customer write permission

Verify create/write permission for Customer, Contact and Address without enabling order/invoice writes.

### Gate 3 — controlled customer test

Use a deliberately selected test booking. Create or map exactly one Customer and verify a second execution is idempotent.

### Gate 4 — service catalog

Create/verify the approved service Items with stable item codes. Vehicle multipliers remain outside the sales-item catalog.

### Gate 5 — operational order

Only after the custom WHITE GLOSS order/vehicle model is available, enable booking-to-order creation. Financial documents remain disabled until their own later acceptance gate.
