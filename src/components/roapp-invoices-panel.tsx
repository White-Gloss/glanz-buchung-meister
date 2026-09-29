import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { parseEuroInput } from "@/lib/money-input";
import {
  recordRoPayment,
  retryRoInvoiceCheck,
  roInvoiceDocument,
  roInvoices,
} from "@/lib/roapp-invoice.functions";

type Overview = Awaited<ReturnType<typeof roInvoices>>;
type Invoice = Overview["invoices"][number];

const euro = (cents: number | null) =>
  ((cents ?? 0) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const date = (value: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-DE") : "–";

const statusText: Record<string, string> = {
  geplant: "Geplant",
  in_arbeit: "Wird erstellt",
  wartet: "Wartet auf Kundendaten",
  pruefung: "Prüfung erforderlich",
  ausgestellt: "Ausgestellt",
  versendet: "Versendet",
  verworfen: "Nicht erstellt",
};
const paymentText: Record<string, string> = {
  offen: "Offen",
  teilbezahlt: "Teilbezahlt",
  bezahlt: "Bezahlt",
};

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function PaymentForm({ invoice, onDone }: { invoice: Invoice; onDone: (text: string) => void }) {
  const open = (invoice.gross_cents ?? 0) - invoice.paid_cents;
  const [amount, setAmount] = useState((open / 100).toFixed(2).replace(".", ","));
  const [method, setMethod] = useState<"bar" | "ueberweisung">("ueberweisung");
  const [paidOn, setPaidOn] = useState(today());
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const id = `pay-${invoice.booking_id}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amountCents = parseEuroInput(amount);
    if (!amountCents) {
      onDone("Bitte den Betrag als Euro-Betrag eingeben, z. B. 178,00.");
      return;
    }
    setPending(true);
    try {
      const result = await recordRoPayment({
        data: {
          invoiceNumber: invoice.invoice_number!,
          amountCents,
          method,
          paidOn,
          requestId,
        },
      });
      onDone(
        result.duplicate
          ? "Diese Zahlung war bereits erfasst."
          : `Zahlung erfasst: ${paymentText[result.paymentStatus || "offen"]}.${method === "bar" ? " Die Quittung wird versendet." : ""}`,
      );
    } catch (error) {
      onDone(error instanceof Error ? error.message : "Zahlung wurde nicht erfasst.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end">
      <Field id={`${id}-amount`} label="Erhaltener Betrag (€)">
        <input
          id={`${id}-amount`}
          className={inputClass}
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </Field>
      <Field id={`${id}-method`} label="Zahlungsart">
        <select
          id={`${id}-method`}
          className={inputClass}
          value={method}
          onChange={(event) => setMethod(event.target.value as "bar" | "ueberweisung")}
        >
          <option value="ueberweisung">Überweisung</option>
          <option value="bar">Bar (Quittung wird erstellt)</option>
        </select>
      </Field>
      <Field id={`${id}-date`} label="Eingangsdatum">
        <input
          id={`${id}-date`}
          type="date"
          className={inputClass}
          max={today()}
          value={paidOn}
          onChange={(event) => setPaidOn(event.target.value)}
          required
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Wird erfasst …" : "Zahlungseingang erfassen"}
      </Button>
    </form>
  );
}

export function RoappInvoicesPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [paying, setPaying] = useState<number | null>(null);

  async function refresh() {
    setOverview(await roInvoices());
  }
  useEffect(() => {
    void refresh().catch(() => setMessage("Rechnungen konnten nicht geladen werden."));
  }, []);

  async function download(number: string) {
    try {
      const { pdf } = await roInvoiceDocument({ data: { invoiceNumber: number } });
      const bytes = Uint8Array.from(atob(pdf), (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Rechnung-${number}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setMessage("PDF konnte nicht geladen werden.");
    }
  }

  async function retry(bookingId: number) {
    try {
      const result = await retryRoInvoiceCheck({ data: { bookingId } });
      setMessage(result.retried ? "Rechnung wird erneut geprüft." : "Keine Prüfung ausstehend.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erneute Prüfung fehlgeschlagen.");
    }
  }

  if (!overview)
    return <p className="mt-8 text-sm text-muted">{message || "Rechnungen werden geladen …"}</p>;
  return (
    <section className="mt-10" aria-labelledby="ro-invoices">
      <h2 id="ro-invoices" className="font-display text-2xl">
        Rechnungen und Zahlungen
      </h2>
      {!overview.enabled ? (
        <p className="mt-3 text-sm text-muted">
          Die automatische Rechnungserstellung ist ausgeschaltet: keine neuen Rechnungen und kein
          Rechnungsversand. Bereits ausgestellte Rechnungen bleiben hier sichtbar; Zahlungseingänge
          können weiter erfasst werden.
        </p>
      ) : (
        <p className="mt-3 max-w-3xl text-sm text-muted">
          Nach „Erledigt“ in RO erstellt die Website die Rechnung aus den RO-Positionen und sendet
          sie per E-Mail. Als bezahlt gilt eine Rechnung erst, wenn hier ein tatsächlicher
          Zahlungseingang erfasst wurde.
        </p>
      )}
      {overview.problems.length > 0 && overview.enabled && (
        <ul className="mt-3 list-disc pl-5 text-sm text-danger">
          {overview.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      )}
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {overview.invoices.map((invoice) => {
          const open = (invoice.gross_cents ?? 0) - invoice.paid_cents;
          const issued = invoice.status === "ausgestellt" || invoice.status === "versendet";
          return (
            <li key={invoice.booking_id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-medium">
                  {invoice.invoice_number || "Noch keine Nummer"} · WG-{invoice.booking_id}
                </p>
                <p className="text-sm tabular-nums">
                  {issued
                    ? `${euro(invoice.gross_cents)} · ${paymentText[invoice.payment_status]}`
                    : ""}
                </p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {statusText[invoice.status] || invoice.status}
                {issued &&
                  ` · Datum ${date(invoice.issued_on)} · fällig ${date(invoice.payment_due_on)} · ${invoice.delivery === "email" ? "E-Mail an Kunden" : "Übergabe durch Inhaber"}`}
                {issued && invoice.paid_cents > 0 && open > 0 && ` · offen ${euro(open)}`}
                {invoice.reason && ` · Grund: ${invoice.reason.replace(/_/g, " ")}`}
                {invoice.attention && ` · Achtung: ${invoice.attention.replace(/_/g, " ")}`}
                {invoice.ro_comment_state === "pruefung" &&
                  " · RO-Hinweis fehlt: in RO keine zweite Rechnung anlegen"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {invoice.invoice_number && (
                  <Button variant="ghost" onClick={() => void download(invoice.invoice_number!)}>
                    PDF
                  </Button>
                )}
                {overview.owner && issued && open > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setPaying(paying === invoice.booking_id ? null : invoice.booking_id)
                    }
                  >
                    Zahlung erfassen
                  </Button>
                )}
                {overview.owner && ["wartet", "pruefung"].includes(invoice.status) && (
                  <Button variant="ghost" onClick={() => void retry(invoice.booking_id)}>
                    Erneut prüfen
                  </Button>
                )}
              </div>
              {paying === invoice.booking_id && (
                <PaymentForm
                  invoice={invoice}
                  onDone={(text) => {
                    setMessage(text);
                    setPaying(null);
                    void refresh();
                  }}
                />
              )}
            </li>
          );
        })}
        {overview.enabled && overview.invoices.length === 0 && (
          <li className="py-4 text-sm text-muted">Noch keine Rechnungen.</li>
        )}
      </ul>
    </section>
  );
}
