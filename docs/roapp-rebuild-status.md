# RO integration: verified state on 19 September 2026

The live website uses TanStack Start, existing IONOS PostgreSQL and private Supabase photo storage. RO App is the operating interface (BOOKING_OPERATIONS=roapp).

## Verified live

- Migrations 0019/0020 applied after a verified private backup. Cutover removed 18 legacy IONOS bookings. The separate Supabase UUID database was archived privately and cleared of 16 bookings and eight condition reports. Archived data and old storage objects are retained separately; this is not irreversible erasure.
- 57 RO catalog entries match website prices. Initial status: Anfrage (Preise prüfen); manual approval: Fixpreis bestätigt. RO tax configuration: inclusive 19% VAT.
- The live package flow created internal WG-48 / RO A002 with a working private photo link. The independent photo-inquiry form created WG-49 / A003 with one ready photo and no fixed price.
- RO history records the approval confirmation email as sent through RO App Gateway. The saved template uses {Public Page URL}. The required signature dialog opens; no binding acceptance was submitted by the agent.
- Release 799f8207b53469acaffa48c9b5924f596668130d passed deployment and live smoke. A genuine RO amount-change webhook at 17:08:57 UTC was accepted and reflected in PostgreSQL at 17:08:58 UTC while reconciliation was stopped. RO uses HMAC-SHA256 of the event ID keyed by the webhook secret. The customer page showed the same 178 EUR fixed test price and approval link.
- Reconciliation timer restarted and verified active. /admin redirects 307 to RO orders. POSTs to legacy operator and Zoho callback return 410.

## Not yet complete

- Invoice issuer draft contains supplied bank/tax details, but RO requires a registration-number field. User has been asked whether a commercial-register entry exists. Do not invent one. Legal entity is not saved; invoice creation/sending has not been validated.
- No signed customer acceptance completed. RO still shows its account-email verification prompt.
- Internal test orders A001/A002/A003 remain for completion of testing and must be cleaned up before final handover.
- Calendar capacity synchronization from manual RO schedule changes is not implemented or verified. Website requests remain provisional.

Do not describe the whole workflow as 100% complete until outstanding steps are independently verified. Never commit bank details, private tax identifiers, keys or personal order/photo tokens.
