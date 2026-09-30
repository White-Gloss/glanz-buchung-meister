import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { retryRoTransfer, roTransfers, setRoTransfer } from "@/lib/roapp-transfer.functions";

type Overview = Awaited<ReturnType<typeof roTransfers>>;

const statusText: Record<string, string> = {
  pending: "Wird übertragen",
  synced: "In RO angelegt",
  review: "Prüfung erforderlich",
  failed: "Fehlgeschlagen",
};

const when = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "short",
  });

export function RoappTransferPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    setOverview(await roTransfers());
  }
  useEffect(() => {
    void refresh().catch(() => setMessage("Übertragungsstatus konnte nicht geladen werden."));
  }, []);

  async function retry(bookingId: number) {
    try {
      const result = await retryRoTransfer({ data: { bookingId } });
      setMessage(
        result.retried
          ? `WG-${bookingId} wird erneut an RO übertragen.`
          : "Keine Übertragung zu wiederholen.",
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erneute Übertragung fehlgeschlagen.");
    }
  }

  async function toggle(enabled: boolean) {
    if (
      !enabled &&
      !window.confirm("Übertragung nach RO anhalten? Neue Anfragen werden gesammelt.")
    )
      return;
    try {
      await setRoTransfer({ data: { enabled } });
      setMessage(
        enabled
          ? "Übertragung nach RO ist eingeschaltet. Wartende Anfragen werden jetzt übertragen."
          : "Übertragung nach RO ist angehalten.",
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Umschalten fehlgeschlagen.");
    }
  }

  if (!overview)
    return (
      <p className="mt-8 text-sm text-muted">{message || "Übertragungsstatus wird geladen …"}</p>
    );
  const setupProblems = [
    !overview.syncEnabled &&
      "Die Übertragung nach RO ist ausgeschaltet. Anfragen warten, bis sie eingeschaltet wird.",
    overview.credentials !== "ok" &&
      (overview.credentials === "invalid"
        ? "Die RO-Zugangsdaten im Server-Environment sind ungültig (z. B. ROAPP_ENTITY_MAP)."
        : "Die RO-Zugangsdaten fehlen im Server-Environment."),
    overview.unqueuedSinceCutover > 0 &&
      `${overview.unqueuedSinceCutover} Anfrage(n) seit der Umschaltung wurden nicht zur Übertragung vorgemerkt.`,
  ].filter(Boolean) as string[];
  return (
    <section className="mt-10" aria-labelledby="ro-transfers">
      <h2 id="ro-transfers" className="font-display text-2xl">
        Übertragung nach RO
      </h2>
      <p className="mt-3 text-sm text-muted">
        Anfragen der letzten sieben Tage: {overview.bookings7d}. Umschaltung:{" "}
        {when(overview.cutover)}.
      </p>
      {setupProblems.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-danger">
          {setupProblems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {overview.owner && (
        <div className="mt-3">
          {overview.syncEnabled ? (
            <Button variant="ghost" onClick={() => void toggle(false)}>
              Übertragung anhalten
            </Button>
          ) : (
            <Button onClick={() => void toggle(true)}>Übertragung nach RO einschalten</Button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      )}
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {overview.rows.map((row) => (
          <li key={row.booking_id} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-medium">WG-{row.booking_id}</p>
              <p className="text-sm">
                {statusText[row.status] || row.status}
                {row.ro_order_id ? ` · RO-Auftrag ${row.ro_order_id}` : ""}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted">
              Eingang {when(row.created_at)} · Versuche {row.attempts}
              {row.last_error && ` · Grund: ${row.reason || row.last_error} (${row.last_error})`}
            </p>
            {overview.owner && ["review", "failed"].includes(row.status) && (
              <div className="mt-2">
                <Button variant="ghost" onClick={() => void retry(row.booking_id)}>
                  Erneut übertragen
                </Button>
              </div>
            )}
          </li>
        ))}
        {overview.rows.length === 0 && (
          <li className="py-4 text-sm text-muted">
            Seit der Umschaltung keine Anfragen vorgemerkt.
          </li>
        )}
      </ul>
    </section>
  );
}
