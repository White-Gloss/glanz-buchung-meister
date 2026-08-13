import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, Inbox, Mail, Paperclip, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getInboxStatus,
  listInboxMessages,
  testInboxConnection,
  type InboxStatus,
} from "@/lib/inbox.functions";
import type { InboxMessage } from "@/lib/inbox.server";

export const Route = createFileRoute("/_authenticated/_admin/admin/posteingang")({
  head: () => ({
    meta: [{ title: "Posteingang | White Gloss" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: PosteingangPage,
});

function datumLesbar(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

function groesseLesbar(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PosteingangPage() {
  const [status, setStatus] = useState<InboxStatus | null>(null);
  const [nachrichten, setNachrichten] = useState<InboxMessage[]>([]);
  const [offen, setOffen] = useState<number | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const fetchStatus = useServerFn(getInboxStatus);
  const fetchNachrichten = useServerFn(listInboxMessages);
  const testen = useServerFn(testInboxConnection);

  const laden = useCallback(async () => {
    setLaedt(true);
    setFehler(null);
    try {
      setNachrichten(await fetchNachrichten({ data: { limit: 25 } }));
    } catch (error) {
      setFehler(error instanceof Error ? error.message : "Unbekannter Fehler.");
    } finally {
      setLaedt(false);
    }
  }, [fetchNachrichten]);

  useEffect(() => {
    let aktiv = true;
    fetchStatus()
      .then((result) => {
        if (!aktiv) return;
        setStatus(result);
        if (result.configured) void laden();
      })
      .catch(() => aktiv && setStatus(null));
    return () => {
      aktiv = false;
    };
  }, [fetchStatus, laden]);

  async function verbindungPruefen() {
    try {
      const ergebnis = await testen({});
      toast.success(`Verbindung steht. ${ergebnis.messages} Nachrichten im Postfach.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Der Test ist fehlgeschlagen.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Zurück zur Übersicht
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-page text-foreground">Posteingang</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Zeigt Ihr bestehendes Postfach an. Nur lesend — hier wird nichts als gelesen markiert,
            verschoben oder gelöscht. Antworten schreiben Sie weiterhin in Ihrem Mailprogramm.
          </p>
        </div>
        {status?.configured && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={verbindungPruefen}>
              Verbindung prüfen
            </Button>
            <Button size="sm" onClick={laden} loading={laedt} disabled={laedt}>
              {laedt ? null : <RefreshCw aria-hidden className="size-4" />}
              Aktualisieren
            </Button>
          </div>
        )}
      </div>

      {status && !status.configured && (
        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <AlertTriangle aria-hidden className="size-4 shrink-0" />
            Der Posteingang ist noch nicht eingerichtet
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Auf dem Server fehlen die Zugangsdaten zum Postfach. Nötig sind <code>IMAP_HOST</code>,{" "}
            <code>IMAP_USER</code> und <code>IMAP_PASSWORD</code> in{" "}
            <code>/etc/white-gloss/environment</code>. Bei IONOS lautet der Server in der Regel{" "}
            <code>imap.ionos.de</code> mit Port <code>993</code>.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Das Passwort gehört ausschließlich auf den Server — niemals ins Projekt und niemals in
            einen Chatverlauf.
          </p>
        </div>
      )}

      {status?.configured && (
        <p className="mt-6 text-xs text-muted-foreground">
          Postfach <span className="text-foreground/80">{status.user}</span> auf{" "}
          <span className="text-foreground/80">{status.host}</span>
        </p>
      )}

      {fehler && (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
          <p className="text-sm leading-6 text-foreground">{fehler}</p>
        </div>
      )}

      {status?.configured && !fehler && (
        <div className="mt-6 space-y-2">
          {nachrichten.length === 0 && !laedt && (
            <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
              <Inbox aria-hidden className="mb-2 size-5 text-primary" />
              <br />
              Keine Nachrichten im Postfach.
            </p>
          )}

          {nachrichten.map((nachricht) => {
            const istOffen = offen === nachricht.uid;
            return (
              <article
                key={nachricht.uid}
                className="overflow-hidden rounded-2xl border border-border bg-card/60"
              >
                <button
                  type="button"
                  onClick={() => setOffen(istOffen ? null : nachricht.uid)}
                  aria-expanded={istOffen}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-secondary/30"
                >
                  <Mail
                    aria-hidden
                    className={`mt-0.5 size-4 shrink-0 ${
                      nachricht.seen ? "text-muted-foreground" : "text-primary"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span
                        className={`truncate ${nachricht.seen ? "text-foreground/80" : "font-semibold text-foreground"}`}
                      >
                        {nachricht.subject}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {datumLesbar(nachricht.date)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {nachricht.from}
                    </span>
                    {nachricht.attachments.length > 0 && (
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Paperclip aria-hidden className="size-3" />
                        {nachricht.attachments.length}{" "}
                        {nachricht.attachments.length === 1 ? "Anhang" : "Anhänge"}
                      </span>
                    )}
                  </span>
                </button>

                {istOffen && (
                  <div className="border-t border-border/60 px-4 pb-4 pt-3">
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-sans text-sm leading-6 text-foreground/85">
                      {nachricht.text || "(Diese Nachricht enthält keinen Text, nur Formatierung.)"}
                    </pre>
                    {nachricht.attachments.length > 0 && (
                      <div className="mt-4 border-t border-border/60 pt-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Anhänge
                        </p>
                        <ul className="mt-2 space-y-1">
                          {nachricht.attachments.map((a) => (
                            <li key={a.filename} className="text-sm text-muted-foreground">
                              {a.filename}{" "}
                              <span className="text-xs tabular-nums">
                                ({groesseLesbar(a.sizeBytes)})
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Anhänge werden hier bewusst nicht zum Herunterladen angeboten. Öffnen Sie
                          sie in Ihrem Mailprogramm, wo der Virenschutz greift.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
