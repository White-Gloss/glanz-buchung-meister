import { useEffect, useState } from "react";
import { getBookingStatus } from "@/lib/booking-status.functions";
const money = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
export function BookingStatus({ id, token }: { id: number; token?: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getBookingStatus>>>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      getBookingStatus({ data: { id, token } })
        .then((value) => {
          if (active) {
            setData(value);
            setFailed(!value);
          }
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, token]);
  if (!data)
    return failed ? (
      <p className="my-6 text-sm text-muted">
        Der Status ist hier nicht verfügbar. Öffnen Sie den persönlichen Link aus Ihrer
        Eingangsbestätigung.
      </p>
    ) : (
      <p className="my-6 text-sm text-muted">Status wird geladen …</p>
    );
  return (
    <section
      aria-label="Auftragsstatus"
      className="my-8 space-y-5 border border-line bg-surface p-6"
    >
      <h2 className="font-display text-2xl">{data.status}</h2>
      <p>
        <span className="text-sm text-muted">
          {data.fixed ? "Bestätigter Fixpreis" : "Unverbindlicher Preis laut Anfrage"}
        </span>
        <br />
        <strong className="text-2xl">{money(data.amount)}</strong>
      </p>
      {!data.fixed && (
        <p className="text-sm text-muted">
          Wir prüfen Ihre Fahrzeugfotos. Den Fixpreis erhalten Sie erst nach unserer persönlichen
          Freigabe.
        </p>
      )}
      {data.scheduledFor && (
        <p>
          Termin:{" "}
          {new Date(data.scheduledFor).toLocaleString("de-DE", {
            timeZone: "Europe/Berlin",
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
      {data.approvalUrl && (
        <a
          className="inline-flex min-h-11 items-center underline"
          href={data.approvalUrl}
          rel="noreferrer"
        >
          Bestätigung ansehen und unterschreiben
        </a>
      )}
      <p className="text-sm">
        <a href={data.statusUrl} className="underline">
          Persönlichen Statuslink öffnen
        </a>
      </p>
      {data.history.length > 0 && (
        <details>
          <summary className="cursor-pointer py-2">Bisheriger Verlauf</summary>
          <ol className="space-y-3 py-3">
            {data.history.map((item) => (
              <li key={item.id} className="text-sm">
                <time>
                  {new Date(item.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}
                </time>
                <br />
                {item.status_name}
                {item.fixed_price ? ` · ${money(item.amount_cents)}` : " · Preisprüfung ausstehend"}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
