# RO rebuild — current verification boundary

The website uses TanStack Start and the existing IONOS PostgreSQL database. Private photos remain in Supabase Storage. RO App is the sole operating interface when `BOOKING_OPERATIONS=roapp`.

Implemented: class-specific catalog mappings, one RO order per inquiry, durable per-write journal, recovery of later photo uploads, protected photo links, Berlin time conversion, signed customer status links and history, canonical RO price/status retrieval, webhook handler plus periodic reconciliation, blocking legacy operating endpoints and redirecting the website admin to RO.

Fixed prices require the configured RO approval status. The initial status is `Anfrage (Preise prüfen)`. Customer approval/signature is handled by the RO public order page. The signature algorithm must be verified against an actual RO webhook before activation.

Live RO setup verified: 57 imported services with matching website prices; required customer signature; booking-confirmation template on `Fixpreis bestätigt`; API access and current location/employee/type; one clearly labelled internal order with one 149 EUR service and a 149 EUR total. The old API key was invalid. The replacement configuration is saved but the running service has not yet restarted.

Additive migrations 0019 and 0020 must precede deployment. `scripts/stage-roapp-production.mjs` creates a verified private database backup before applying them and storing the catalog mapping. It does not enable integration or delete records.

Outstanding: production deployment and full browser-to-RO photo test, actual webhook signature verification, old booking cleanup after backup, invoice issuer setup and invoice dispatch verification. RO currently requires both registration and VAT IDs for a legal entity; neither may be invented. Supplied bank/tax details are not committed to the repository.
