import { useEffect, useState } from "react";
import { listOpenWebsiteInquiries } from "@/lib/hub-inquiries.functions";

function euro(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function OpenInquiriesPanel() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listOpenWebsiteInquiries>>["inquiries"] | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listOpenWebsiteInquiries()
      .then((result) => {
        if (!cancelled) setRows(result.inquiries);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Anfragen nicht geladen.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyAll() {
    if (!rows) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ inquiries: rows }));
      setCopied("Liste kopiert. Im Hub unter Anfragen einfügen.");
    } catch {
      setCopied("Kopieren hat der Browser abgelehnt. Die Liste bleibt unten sichtbar.");
    }
  }

  return (
    <section className="mt-8 rounded-md border border-line bg-surface p-5">
      <h2 className="font-display text-2xl">Offene Website-Anfragen</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        Notfall, wenn der Hub sie nicht selbst holt. Hier nur ansehen, anrufen und die Liste kopieren.
        Status, Preis und Termin bleiben unverändert.
      </p>
      {error ? <p className="mt-4 text-sm text-muted">{error}</p> : null}
      {rows && rows.length === 0 ? <p className="mt-4 text-sm text-muted">Gerade keine offene Anfrage.</p> : null}
      {rows && rows.length > 0 ? (
        <>
          <button
            type="button"
            className="mt-4 inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm"
            onClick={() => void copyAll()}
          >
            Liste für den Hub kopieren
          </button>
          {copied ? <p className="mt-2 text-sm text-muted">{copied}</p> : null}
          <ul className="mt-4 divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="space-y-1 py-3 text-sm">
                <p className="font-medium">
                  WG-{row.id} · {row.customer_name}
                </p>
                <p className="text-muted">
                  {row.phone ? (
                    <a className="underline" href={`tel:${row.phone}`}>
                      {row.phone}
                    </a>
                  ) : (
                    "Telefon fehlt"
                  )}
                  {row.email ? (
                    <>
                      {" · "}
                      <a className="underline" href={`mailto:${row.email}`}>
                        {row.email}
                      </a>
                    </>
                  ) : (
                    " · E-Mail fehlt"
                  )}
                </p>
                <p className="text-muted">
                  {row.package_id || "Paket offen"} · {row.class_id || "Klasse offen"}
                  {row.extra_ids.length ? ` · ${row.extra_ids.join(", ")}` : ""} · {euro(row.total_cents)}
                </p>
                <p className="text-muted">
                  Wunsch: {row.preferred_date || "offen"} {row.preferred_slot}
                  {row.city_slug ? ` · ${row.city_slug}` : ""}
                  {row.vehicle ? ` · ${row.vehicle}` : ""}
                </p>
                {row.address ? <p className="text-muted">{row.address}</p> : null}
                {row.note ? <p className="whitespace-pre-wrap text-muted">{row.note}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
