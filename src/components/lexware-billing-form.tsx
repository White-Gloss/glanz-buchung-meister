import { useState } from "react";
import { saveLexwareBillingData } from "@/lib/lexware.functions";
import { Button, inputClass } from "./ui";
import { eur } from "@/lib/utils";

export function LexwareBillingForm({
  bookingId,
  totalCents,
  onSaved,
}: {
  bookingId: number;
  totalCents: number;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <details className="w-full rounded-md border border-line p-3">
      <summary className="cursor-pointer">Rechnungsadresse und Endpreis prüfen</summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await saveLexwareBillingData({
              data: {
                bookingId,
                totalCents,
                street: String(form.get("street")),
                zip: String(form.get("zip")),
                city: String(form.get("city")),
                countryCode: String(form.get("country")),
                serviceDate: String(form.get("serviceDate")),
                approved: true,
              },
            });
            await onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Straße und Hausnummer
          <input
            name="street"
            className={inputClass}
            required
            minLength={3}
            maxLength={150}
            disabled={busy}
          />
        </label>
        <label>
          Postleitzahl
          <input
            name="zip"
            className={inputClass}
            required
            minLength={3}
            maxLength={16}
            disabled={busy}
          />
        </label>
        <label>
          Ort
          <input
            name="city"
            className={inputClass}
            required
            minLength={2}
            maxLength={100}
            disabled={busy}
          />
        </label>
        <label>
          Land (Ländercode)
          <input
            name="country"
            className={inputClass}
            defaultValue="DE"
            pattern="[A-Z]{2}"
            required
            maxLength={2}
            disabled={busy}
          />
        </label>
        <label>
          Tatsächlicher Leistungstag
          <input name="serviceDate" type="date" className={inputClass} required disabled={busy} />
        </label>
        <p className="self-center">
          Endpreis laut Buchung: <strong>{eur(totalCents / 100)}</strong>
        </p>
        <label className="flex items-start gap-2 sm:col-span-2">
          <input type="checkbox" required disabled={busy} />
          Ich habe den Endpreis und die Rechnungsdaten geprüft. Bei aktiver Rechnungsautomatik darf
          Lexware nach Auftragsabschluss die verbindliche Rechnung erzeugen.
        </label>
        {error ? (
          <p role="alert" className="text-danger sm:col-span-2">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Speichern …" : "Rechnungsdaten freigeben"}
        </Button>
      </form>
    </details>
  );
}
