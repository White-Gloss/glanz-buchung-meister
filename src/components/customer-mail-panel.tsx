import { useEffect, useState } from "react";
import { customerMailOverview, setAutomaticCustomerMail } from "@/lib/customer-mail.functions";
import { Button } from "./ui";

export function CustomerMailPanel({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof customerMailOverview>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  async function reload() {
    setData(await customerMailOverview());
  }
  useEffect(() => {
    let active = true;
    void customerMailOverview().then(
      (value) => {
        if (active) setData(value);
      },
      () => {
        if (active) setError("Versandstatus konnte nicht geladen werden.");
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="mt-8 rounded-md border border-line bg-surface p-5">
      <h2 className="font-display text-2xl">Kundenpost & Versandverlauf</h2>
      <p className="mt-2 text-sm text-muted">
        Eingangsbestätigungen und manuell freigegebene Auftragsbestätigungen werden über Resend
        versendet. Die Rechnungs-PDFs stammen ausschließlich aus Lexware. Alte wartende Kundenmails
        werden nicht automatisch nachgesendet.
      </p>
      <p className="mt-2 text-sm">
        Resend:{" "}
        {data
          ? data.configured
            ? "Schlüssel und Absender hinterlegt (Zustellung siehe Verlauf)"
            : "Nicht vollständig eingerichtet"
          : "Wird geladen"}
        . Rechnungsversand und Zahlungserinnerung: {data?.automatic ? "Automatisch" : "Manuell"}.
      </p>
      {canManage ? (
        <div className="mt-4 space-y-3">
          {!data?.automatic ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={approved}
                onChange={(event) => setApproved(event.target.checked)}
              />
              Automatischer Versand für Aufträge mit freigegebenen Rechnungsdaten: neue fertige
              Rechnungen sowie einmalig eine gebührenfreie Zahlungserinnerung frühestens sieben Tage
              nach Fälligkeit. Lexware-Zahlungsstand wird vor dem Versand erneut geprüft.
            </label>
          ) : null}
          <Button
            type="button"
            disabled={busy || !data || (!data.automatic && (!approved || !data.configured))}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await setAutomaticCustomerMail({
                  data: { enabled: !data?.automatic, approved: true },
                });
                setApproved(false);
                await reload();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Umstellung fehlgeschlagen.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {data?.automatic
              ? "Automatischen Rechnungsversand pausieren"
              : "Automatischen Rechnungsversand freigeben"}
          </Button>
        </div>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => void reload().catch(() => setError("Aktualisierung fehlgeschlagen."))}
      >
        Versandverlauf aktualisieren
      </Button>
      {error ? (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-line">
        {data?.rows.map((row) => (
          <li key={row.id} className="py-3 text-sm">
            <p>{row.subject}</p>
            <p className="text-muted">
              {row.to_addr} · {row.status} · Zustellung: {row.delivery_status}
            </p>
            {row.last_error_code ? <p>Prüfung erforderlich: {row.last_error_code}</p> : null}
          </li>
        ))}
      </ul>
      {data && !data.rows.length ? (
        <p className="mt-3 text-sm text-muted">Noch keine Nachrichten im neuen Versandablauf.</p>
      ) : null}
    </section>
  );
}
