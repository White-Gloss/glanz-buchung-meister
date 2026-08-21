# ERPNext Service Catalog — Controlled Write Gate

This gate creates only the fixed WHITE GLOSS service catalog after a successful read-only preview.

Safety constraints:

- admin-authenticated Edge Function only;
- fixed allow-list of 12 item codes; no arbitrary item payload;
- exact item-code lookup before each create;
- requires Item Group `Services` and UOM `Nos` to exist;
- creates non-stock sales items only;
- does not create prices, invoices, payments, accounts or warehouses;
- commit requires explicit confirmation value from the admin UI;
- replay is idempotent: existing valid items are reused;
- ambiguous or invalid existing items stop the write path;
- network/5xx uncertainty stops automatic continuation.

Item template:

- `item_group = Services`
- `stock_uom = Nos`
- `is_stock_item = 0`
- `is_sales_item = 1`
- `is_purchase_item = 0`

The gate must be re-run in preview after deployment before commit is offered.
