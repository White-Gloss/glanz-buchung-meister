import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAuditLog, type AuditLogEntry } from "@/lib/bookings.functions";

const actionStyles: Record<string, string> = {
  "Buchung erstellt": "border-sky-500/30 bg-sky-500/15 text-sky-300",
  "Status geändert": "border-primary/40 bg-primary/15 text-primary",
  "Anzahlung geändert": "border-amber-500/30 bg-amber-500/15 text-amber-300",
  "Buchung gelöscht": "border-destructive/40 bg-destructive/15 text-destructive",
};

export function AuditLogPanel() {
  const fetchLog = useServerFn(listAuditLog);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchLog()
      .then((rows) => {
        setEntries(rows);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Audit-Log konnte nicht geladen werden"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="glass mt-8 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="size-5 text-primary" />
          <h2 className="display-card">Audit-Log</h2>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Alle Änderungen an Buchungen – nachvollziehbar mit Zeitpunkt und ausführender Person.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-destructive">{error}</p>
      ) : loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Einträge werden geladen …</p>
      ) : entries.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Noch keine Einträge vorhanden.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="grid gap-2 rounded-xl border border-border bg-secondary/30 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
            >
              <span
                className={`w-fit rounded-full border px-2.5 py-0.5 text-xs ${
                  actionStyles[e.action] ?? "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {e.action}
              </span>
              <span className="min-w-0 text-sm text-foreground/85">
                {e.invoiceNumber ? <span className="text-primary">{e.invoiceNumber}</span> : null}
                {e.field ? ` · ${e.field}: ` : " · "}
                {e.oldValue ? `${e.oldValue} → ` : ""}
                {e.newValue ?? "—"}
                {e.actorEmail ? (
                  <span className="text-muted-foreground"> · {e.actorEmail}</span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground sm:text-right">
                {new Date(e.createdAt).toLocaleString("de-DE", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}{" "}
                Uhr
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
