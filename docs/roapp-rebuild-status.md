# RO integration: verified state on 19 September 2026

The live website uses TanStack Start, existing IONOS PostgreSQL and private Supabase photo storage. RO App is the operating interface (BOOKING_OPERATIONS=roapp).

## Verified live

- Migrations 0019/0020 applied after a verified private backup. Cutover removed 18 legacy IONOS bookings. The separate Supabase UUID database was archived privately and cleared of 16 bookings and eight condition reports. Archived data and old storage objects are retained separately; this is not irreversible erasure.
- 57 RO catalog entries match website prices. Initial status: Anfrage (Preise prüfen); manual approval: Fixpreis bestätigt. RO tax configuration: inclusive 19% VAT.
- The live package flow created internal WG-48 / RO A002 with a working private photo link. The independent photo-inquiry form created WG-49 / A003 with one ready photo and no fixed price.
- RO history records the approval confirmation email as sent through RO App Gateway. The saved template uses {Public Page URL}; the required signature flow was subsequently completed on the internal test only, as recorded below.
- Release 799f8207b53469acaffa48c9b5924f596668130d passed deployment and live smoke. A genuine RO amount-change webhook at 17:08:57 UTC was accepted and reflected in PostgreSQL at 17:08:58 UTC while reconciliation was stopped. RO uses HMAC-SHA256 of the event ID keyed by the webhook secret. The customer page showed the same 178 EUR fixed test price and approval link.
- Reconciliation timer restarted and verified active. /admin redirects 307 to RO orders. POSTs to legacy operator and Zoho callback return 410.
- RO permits invoice creation without a legal entity. The German invoice template now contains the supplied issuer, bank and tax details, verified again after reload. A dedicated German invoice email template is saved. No registration number was invented.
- Internal invoice 001 (533163), explicitly labelled as a technical test with no payment claim, was created from A002: 178 EUR gross including 28.42 EUR VAT. RO confirmed email sending with the invoice document selected as attachment. The test invoice was then cancelled; the cancelled status persisted after reload.
- On user continuation, A002 was accepted with a visibly drawn TEST signature at 18:03 UTC. RO showed accepted/signed timestamps and its order history recorded customer acceptance. The website database subsequently held status Akzeptiert, 17800 cents and fixed_price=true.
- PR 236 deployed as release 91ef2dace073f7336e84b1c3cc2e7b3b64f7799e: main CI, deployment 35460135085 and live smoke passed. The public imprint returned HTTP 200 and the supplied VAT ID.
- Internal RO orders A001/A002/A003 were deleted after testing. Website test bookings WG-48/WG-49 and their photo-link metadata were removed after identity checks and a verified private backup at /var/backups/white-gloss/20260919T181424Z/database.dump. No payment was booked. Cancelled test invoice 001 remains as an audit record; storage files remain private in the backup/retention scope.

## Not yet complete

- The generated invoice PDF could not be visually inspected because browser security blocked RO's blob print preview. Issuing/sending regular invoices is manual after service completion; select the invoice attachment, verify customer billing details, and enter the service period in the invoice comment. No automatic invoice issuance is configured. The optional legal-entity draft is not saved.
- RO still shows its account-email verification prompt. No real customer's signature was submitted.
- Calendar capacity synchronization from manual RO schedule changes is not implemented or verified. Website requests remain provisional.

Do not describe the whole workflow as 100% complete until outstanding steps are independently verified. Never commit bank details, private tax identifiers, keys or personal order/photo tokens.
