# WHITE GLOSS OS

Private Frappe/ERPNext v16 app for WHITE GLOSS operational vehicle and detailing-order management.

This app keeps customer vehicles separate from ERPNext's standard fleet `Vehicle` DocType and keeps operational orders separate from accounting documents.

## Included DocTypes

- `WHITE GLOSS Vehicle`
- `WHITE GLOSS Order`
- `WHITE GLOSS Order Service` (child table)

## Compatibility

- Frappe >=16.0.0,<17.0.0
- ERPNext >=16.0.0,<17.0.0
- Python >=3.14,<3.15

## Safety

The app does not create Sales Invoices, Payment Entries, GL Entries, stock ledger entries, or other accounting postings.
