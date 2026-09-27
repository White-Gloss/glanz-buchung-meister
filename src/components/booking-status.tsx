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
        <strong className="text-2xl">
          {!data.fixed && data.amount === 0 ? "Preis wird ermittelt" : money(data.amount)}
        </strong>
      </p>
      {failed && (
        <p role="status" className="text-sm text-muted">
          Die Aktualisierung ist gerade nicht möglich. Angezeigt wird der zuletzt geladene Stand.
        </p>
      )}
      {data.scheduledFor && (
        <p>
          {data.fixed ? "Termin laut Auftrag" : "Wunschtermin (noch unbestätigt)"}:{" "}
          {new Date(data.scheduledFor).toLocaleString("de-DE", {
            timeZone: "Europe/Berlin",
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
      <p className="text-sm">
        <a href={data.statusUrl} className="underline">
          Persönlichen Statuslink öffnen
        </a>
      </p>
    </section>
  );
}
