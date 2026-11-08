# OpenAI server-side lead measurement

The public configurator has a separate unchecked, per-request checkbox. It does
not reuse Google consent, persist consent, install an SDK, or scan form fields.
Only after opt-in, submitting the form reads `oppref` from the current URL.
Navigation that removes this query parameter loses click attribution; no
cross-page or cross-session attribution storage is implemented.

After a new request commits successfully, the server makes one bounded (2 s)
attempt. Replayed bookings and failed saves do not send events. Delivery failure
does not undo the booking. There is no background retry or guaranteed delivery.
The request UUID is domain-separated and hashed for a stable opaque event ID;
the UUID itself, customer fields, browser headers, and URL queries are not sent.
`user` is omitted entirely and `opt_out` is true. Without an available click
reference, attribution is limited; this does not prove a measurable ad conversion.

## Activation

Set only in the existing website server's protected runtime environment:

- `OPENAI_CONVERSIONS_PIXEL_ID`: the existing White Gloss website pixel ID.
- `OPENAI_CONVERSIONS_API_KEY`: a Conversion key from that same Ads Manager account.

Never use `VITE_` variables or commit the key. Missing configuration disables
sending. Restart through the approved production procedure after environment
changes. Do not replace the other existing environment entries.

Before activation, run `node scripts/validate-openai-conversions.mjs` using the
server environment. It always sets `validate_only: true`. The API validates without
saving it. Do not create a real booking or send a synthetic production conversion.
Check the real event stream only after an actual visitor consents and submits.

Consent can be withdrawn before submission by clearing the checkbox; it is not
retained for subsequent visits. The separate checkbox is unrelated to the Google
cookie settings. For an already transmitted event, direct deletion requests to
the business contact in the privacy notice.

API contract: https://developers.openai.com/ads/conversions-api
