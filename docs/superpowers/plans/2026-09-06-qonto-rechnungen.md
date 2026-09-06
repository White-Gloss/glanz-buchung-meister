# Qonto-Rechnungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beim Setzen einer Buchung auf `erledigt` eine finalisierte Qonto-Kundenrechnung anlegen; Kunden-Mail erst nach Admin-Klick.

**Architecture:** Schlanker Qonto-HTTP-Client analog `resend-mail.ts`; Trigger in `updateBookingStatus` bei Status `erledigt` (idempotent); Mapping-Spalten an `bookings`; UI in `admin.unterlagen` ohne Lexware-Copy. Qonto ist Source of Truth — lokal nur IDs/Status/Fehler.

**Tech Stack:** TanStack Start (`createServerFn`), `node:test`, Postgres `migrations/0006_qonto_invoice.sql`, Qonto Business API v2 (`https://thirdparty.qonto.com/v2`).

**Spec:** `docs/superpowers/specs/2026-09-06-qonto-rechnungen-design.md`

## Global Constraints

- Qonto ist Source of Truth für ausgehende Kundenrechnungen; lokal nur Mapping/Status.
- MwSt-Default **0.19** (19 %) auf Leistungen, sofern Position nichts anderes vorgibt.
- Rechnung nach Anlegen **automatisch finalisieren** (`POST .../finalize`).
- Kunden-Mail **nur** nach manuellem Admin-Klick (kein Auto-Send).
- Env: `QONTO_SECRET_KEY` + `QONTO_IBAN` in `/etc/white-gloss/environment` (Werte mit Leerzeichen **quoten**); nie committen.
- `QONTO_SECRET_KEY` = voller Authorization-Wert `login:secret` (ohne `Bearer`/`Basic`-Prefix), analog Qonto-Doku.
- Keine ERPNext-Finanzbelege (keine Sales Invoice / Payment Entry / GL).
- Idempotent: vorhandenes `qonto_invoice_id` -> kein zweites Create.
- UI-Copy und Fehlermeldungen auf **Deutsch**.
- Logs: nur Statuscodes / gekuerzte Responses, keine Keys/Secrets.
- Tests: `node --experimental-strip-types --test` wie im Repo; neue Testfiles in `package.json` `test`-Script registrieren.
- Vor Coding Base-URL und Payload-Felder in aktueller Qonto-Doku verifizieren.

## File map

| File | Role |
|------|------|
| `migrations/0006_qonto_invoice.sql` | Neue Mapping-Spalten an `bookings` |
| `src/lib/qonto-mail.ts` | `qontoConfigured()` + schlanker HTTP-Client (Clients, Invoices, Finalize, Send) |
| `src/lib/qonto-mail.test.ts` | TDD wie `resend-mail.test.ts` |
| `src/lib/qonto-invoice.ts` | `ensureQontoInvoiceForBooking` + `sendQontoInvoiceEmailForBooking` (Idempotenz, Failed-Pfade) |
| `src/lib/qonto-invoice.test.ts` | Unit-Tests mit gemocktem Client / SQL-Stubs |
| `src/lib/bookings.functions.ts` | `updateBookingStatus` -> bei `erledigt` Invoice sicherstellen; `BookingRow` um Qonto-Felder |
| `src/lib/admin.functions.ts` | `sendQontoInvoice` / `retryQontoInvoice` Server-Fns; Lexware-Texte entfernen |
| `src/routes/admin.unterlagen.tsx` | Lexware-Hinweis raus; Qonto-Status + Senden/Retry-Buttons |
| `docs/ops-qonto-env.md` | VPS-Checklist Env + Scopes |
| `package.json` | Test-Script um `qonto-mail.test.ts` / `qonto-invoice.test.ts` erweitern |

---
### Task 1: Migration Qonto-Mapping-Spalten

**Files:**
- Create: `migrations/0006_qonto_invoice.sql`

**Interfaces:**
- Consumes: bestehende Tabelle `bookings`
- Produces: Spalten `qonto_client_id`, `qonto_invoice_id`, `qonto_invoice_number`, `qonto_invoice_status`, `qonto_invoice_error`, `qonto_sent_at`

- [ ] **Step 1: Write migration SQL**

```sql
-- migrations/0006_qonto_invoice.sql
-- Qonto client-invoice mapping on bookings

alter table bookings
  add column if not exists qonto_client_id text,
  add column if not exists qonto_invoice_id text,
  add column if not exists qonto_invoice_number text,
  add column if not exists qonto_invoice_status text,
  add column if not exists qonto_invoice_error text,
  add column if not exists qonto_sent_at timestamptz;

comment on column bookings.qonto_invoice_status is
  'pending | unpaid | sent | failed - local mirror; Qonto is authoritative';

create index if not exists bookings_qonto_invoice_id_idx
  on bookings (qonto_invoice_id)
  where qonto_invoice_id is not null;
```

- [ ] **Step 2: Verify migration naming / check script**


Run: `npm run check:migrations`
Expected: PASS

- [ ] **Step 3: Commit**
Message: `chore(db): add Qonto invoice mapping columns on bookings`
Add: `migrations/0006_qonto_invoice.sql`

---


### Task 2: Qonto HTTP-Client + `qontoConfigured` (TDD)

**Files:**
- Create: `src/lib/qonto-mail.ts`
- Create: `src/lib/qonto-mail.test.ts`
- Modify: `package.json` — `test`-Script um `src/lib/qonto-mail.test.ts` ergaenzen

**Interfaces:**
- Consumes: `process.env.QONTO_SECRET_KEY`, `process.env.QONTO_IBAN`; optional `QONTO_STAGING_TOKEN` / `QONTO_API_BASE`
- Produces:
  - `qontoConfigured(): boolean`
  - `findOrCreateQontoClient(input: { name: string; email: string; currency?: "EUR" }): Promise<{ id: string }>`
  - `createAndFinalizeClientInvoice(input: QontoInvoiceCreateInput): Promise<{ id: string; invoice_number: string; status: string }>`
  - `sendClientInvoiceEmail(input: { invoiceId: string; to: string; emailTitle: string; emailBody?: string }): Promise<void>`
  - Types: `QontoInvoiceLine`, `QontoInvoiceCreateInput` with `vat_rate` default `"0.19"`

Hinweis: Payload-Feldnamen vor Implementierung in Qonto-Doku verifizieren. Authorization-Header = Rohwert `QONTO_SECRET_KEY` (`login:secret`). Base URL default `https://thirdparty.qonto.com/v2`.

- [ ] **Step 1: Write the failing test for `qontoConfigured`**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { qontoConfigured } from "./qonto-mail.ts";

describe("qontoConfigured", () => {
  it("is true only when QONTO_SECRET_KEY and QONTO_IBAN are set", () => {
    const prevKey = process.env.QONTO_SECRET_KEY;
    const prevFrom = process.env.QONTO_IBAN;
    try {
      delete process.env.QONTO_SECRET_KEY;
      delete process.env.QONTO_IBAN;
      assert.equal(qontoConfigured(), false);

      process.env.QONTO_SECRET_KEY = "login:secret";
      delete process.env.QONTO_IBAN;
      assert.equal(qontoConfigured(), false);

      delete process.env.QONTO_SECRET_KEY;
      process.env.QONTO_IBAN = "DE89370400440532013000";
      assert.equal(qontoConfigured(), false);

      process.env.QONTO_SECRET_KEY = "login:secret";
      process.env.QONTO_IBAN = "DE89370400440532013000";
      assert.equal(qontoConfigured(), true);

      process.env.QONTO_SECRET_KEY = "  ";
      process.env.QONTO_IBAN = "DE89370400440532013000";
      assert.equal(qontoConfigured(), false);
    } finally {
      if (prevKey === undefined) delete process.env.QONTO_SECRET_KEY;
      else process.env.QONTO_SECRET_KEY = prevKey;
      if (prevFrom === undefined) delete process.env.QONTO_IBAN;
      else process.env.QONTO_IBAN = prevFrom;
    }
  });
});

```


- [ ] **Step 2: Run test to verify it fails**

Run: node --experimental-strip-types --test src/lib/qonto-mail.test.ts
Expected: FAIL (module not found)

- [ ] **Step 3: Implement src/lib/qonto-mail.ts**

Mirror resend-mail.ts: configured gate, auth header from env, client find-or-create, create then finalize invoice, send email helper. Default VAT 0.19. Verify live Qonto payload field names before coding.

- [ ] **Step 4: Run tests expect PASS**

- [ ] **Step 5: Register tests in package.json test script**

- [ ] **Step 6: Commit**

Message: feat(qonto): HTTP client and qontoConfigured gate

---

### Task 3: ensureQontoInvoiceForBooking + sendQontoInvoiceEmailForBooking

**Files:**
- Create: `src/lib/qonto-invoice.ts`
- Create: `src/lib/qonto-invoice.test.ts`
- Modify: `package.json` test script

**Interfaces:**
- Consumes: helpers from qonto-mail.ts; sql tag compatible with getSql()
- Produces: `buildInvoiceLinesFromBooking`, `ensureQontoInvoiceForBooking(sql, bookingId, deps?)`, `sendQontoInvoiceEmailForBooking(sql, bookingId, deps?)`, optional `QontoInvoiceDeps` for tests

Idempotenz und Failed-Pfade:
1. Wenn qonto_invoice_id gesetzt -> kein Create; return ok.
2. Nicht konfiguriert -> status failed, DE-Error; Buchung bleibt erledigt.
3. Fehlende Kunden-E-Mail -> failed mit klarer DE-Meldung.
4. API-Fehler -> failed + qonto_invoice_error ohne Secrets; kein Doppel-Create.
5. Erfolg -> client_id, invoice_id, invoice_number, status unpaid.
6. Send nur mit Invoice-ID; danach qonto_sent_at und status sent.

- [ ] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInvoiceLinesFromBooking } from "./qonto-invoice.ts";

describe("buildInvoiceLinesFromBooking", () => {
  it("uses default VAT 0.19 and EUR unit price", () => {
    const lines = buildInvoiceLinesFromBooking({
      customer_name: "Max Mustermann",
      email: "max@example.com",
      package_id: "signature",
      package_name: "Signature",
      extra_names: ["Innenraum"],
      total_cents: 11900,
      pickup_cents: 0,
    });
    assert.ok(lines.length >= 1);
    assert.equal(lines[0].vat_rate, "0.19");
    assert.equal(lines[0].unit_price.currency, "EUR");
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: node --experimental-strip-types --test src/lib/qonto-invoice.test.ts

- [ ] **Step 3: Implement qonto-invoice.ts**

- buildInvoiceLinesFromBooking: service cents = total - pickup; optional pickup line; vat 0.19; resolve package/extra names from data/site.
- ensure/send helpers with injectable deps; shop_id white-gloss; DE error messages.

- [ ] **Step 4: Run tests — expect pass**

- [ ] **Step 5: Commit**

Message: feat(qonto): ensure and send invoice helpers with idempotency

---

### Task 4: Wire updateBookingStatus + Admin Server-Fns

**Files:**
- Modify: src/lib/bookings.functions.ts
- Modify: src/lib/admin.functions.ts

**Interfaces:**
- Consumes: ensure + send helpers
- Produces: sendQontoInvoice / retryQontoInvoice server functions

- [ ] **Step 1:** On erledigt in updateBookingStatus, call ensure via safeExec; never rollback erledigt.

- [ ] **Step 2:** Extend BookingRow + listBookings with six qonto columns.

- [ ] **Step 3:** Admin sendQontoInvoice + retryQontoInvoice (operator auth).

- [ ] **Step 4:** Remove Lexware copy from document body helper.

- [ ] Step 5: run typecheck

- [ ] Step 6: Commit message feat(qonto): trigger invoice on erledigt and admin send/retry

---

### Task 5: UI Dokumente — Lexware raus, Send/Retry

**Files:**
- Modify: src/routes/admin.unterlagen.tsx

**Interfaces:**
- Consumes: listBookings with qonto fields, sendQontoInvoice, retryQontoInvoice
- Produces: German UI without Lexware; status/number/error; buttons Per E-Mail senden / Erneut versuchen

- [ ] Step 1: Replace intro copy (no Lexware; Qonto on erledigt; mail after click).

- [ ] Step 2: Qonto section showing number/status/error/sent_at; send button when unpaid or failed-after-send; retry when failed.

- [ ] Step 3: Manual UI sanity on /admin/unterlagen

- [ ] Step 4: Commit message feat(admin): Qonto invoice status and send/retry on Unterlagen

---

### Task 6: Ops-Doku VPS Checklist

**Files:**
- Create: docs/ops-qonto-env.md

- [ ] Step 1: Write checklist for /etc/white-gloss/environment
  - Quote values with spaces
  - Required: QONTO_SECRET_KEY="login:secret", QONTO_IBAN
  - Scopes: client.read, client.write, client_invoice.read, client_invoice.write
  - Optional staging token / API base
  - Deploy check: restart unit, mark booking erledigt, verify Qonto finalize, admin send, logs without secrets
  - Do not: commit secrets, ERPNext finance, auto-mail without click

- [ ] Step 2: Commit message docs(ops): Qonto VPS environment checklist

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Trigger booking to erledigt | Task 4 |
| Idempotency via qonto_invoice_id | Task 3, 4 |
| Client findOrCreate by email | Task 2, 3 |
| Line items + VAT 0.19 default | Task 3 |
| Create draft + finalize | Task 2 |
| Store local IDs/number/status | Task 1, 3 |
| Mail only after admin click | Task 3, 4, 5 |
| Columns on bookings | Task 1 |
| qontoConfigured / env key+IBAN | Task 2, 6 |
| UI without Lexware; send/retry | Task 5 (+ Task 4 copy) |
| failed status; booking stays erledigt | Task 3, 4 |
| No secrets in repo; VPS docs | Task 6 |
| No ERPNext finance | Global Constraints + Out of scope |

## Out of scope (v1)

- Paid webhooks / status paid writeback
- Quotes / credit notes in Qonto
- Lexware integration
- ERPNext Sales Invoice / Payment Entry / GL
- Automatic customer email without admin click

## Execution handoff

Plan complete and saved to docs/superpowers/plans/2026-09-06-qonto-rechnungen.md. Two execution options:

1. Subagent-Driven (recommended) — fresh subagent per task (superpowers:subagent-driven-development)
2. Inline Execution — batch with checkpoints (superpowers:executing-plans)

