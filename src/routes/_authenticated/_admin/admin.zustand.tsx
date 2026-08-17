import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Camera, Images, Mail, Phone, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  listConditionReports,
  getConditionPhotoUrls,
  getConditionUploadStatus,
  cleanupOrphanedConditionMedia,
  updateConditionReport,
  deleteConditionReport,
  CONDITION_STATUSES,
  type ConditionReport,
  type ConditionStatus,
  type ConditionUploadStatus,
  type OrphanCleanupResult,
} from "@/lib/conditionReports.functions";
import { assessConditionPhotos, getAssistantStatus } from "@/lib/assistant.functions";
import { diagnoseBackendError } from "@/lib/backendErrors";
import { SupabaseConfigNotice } from "@/components/SupabaseConfigNotice";
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";

/**
 * ZUSTANDSMELDUNGEN IM ADMIN-BEREICH
 * -----------------------------------
 * Fotos und Videos liegen privat im Storage. Erst beim Aufklappen werden
 * dafür zeitlich begrenzte signierte Links erzeugt.
 */

export const Route = createFileRoute("/_authenticated/_admin/admin/zustand")({
  head: () => ({
    meta: [
      { title: "Zustandsmeldungen – White Gloss Detailing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConditionAdminRoute,
  errorComponent: ({ error }) => <SupabaseConfigNotice info={diagnoseBackendError(error)} />,
});

function ConditionAdminRoute() {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return <SupabaseConfigNotice missing={config.missing} />;
  return <ConditionAdminPage />;
}

const statusStyles: Record<ConditionStatus, string> = {
  Neu: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Gesehen: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Beantwortet: "bg-primary/15 text-primary border-primary/40",
  Erledigt: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isVideoPath(path: string): boolean {
  return /\.(mp4|mov|webm)$/i.test(path);
}

/** Nur Bilder lassen sich beurteilen — Videos zählen hier nicht mit. */
function bildAnzahl(paths: string[]): number {
  return paths.filter((path) => !isVideoPath(path)).length;
}

function ConditionAdminPage() {
  const [reports, setReports] = useState<ConditionReport[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assistent, setAssistent] = useState(false);
  const [upload, setUpload] = useState<ConditionUploadStatus | null>(null);
  const fetchAll = useServerFn(listConditionReports);
  const fetchAssistentStatus = useServerFn(getAssistantStatus);
  const fetchUploadStatus = useServerFn(getConditionUploadStatus);

  const reload = useCallback(() => {
    setLoadError(null);
    void fetchAll({})
      .then(setReports)
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Meldungen konnten nicht geladen werden.",
        );
      });
  }, [fetchAll]);

  useEffect(() => {
    let active = true;
    void fetchAll({})
      .then((rows) => {
        if (active) setReports(rows);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Meldungen konnten nicht geladen werden.",
        );
      });
    return () => {
      active = false;
    };
  }, [fetchAll]);

  // Ohne eingerichteten Assistenten erscheint der Knopf zur Bildbewertung gar
  // nicht — besser als ein Knopf, der nur eine Fehlermeldung auswirft.
  useEffect(() => {
    let active = true;
    void fetchAssistentStatus()
      .then((status) => active && setAssistent(status.configured))
      .catch(() => active && setAssistent(false));
    return () => {
      active = false;
    };
  }, [fetchAssistentStatus]);

  // Ob der Upload überhaupt funktionieren kann. Ohne diesen Hinweis fiele ein
  // fehlender Serverschlüssel erst dadurch auf, dass wochenlang keine Meldung
  // mehr eingeht — und das sieht von hier aus genauso aus wie eine ruhige
  // Woche.
  useEffect(() => {
    let active = true;
    void fetchUploadStatus()
      .then((status) => active && setUpload(status))
      .catch(() => active && setUpload(null));
    return () => {
      active = false;
    };
  }, [fetchUploadStatus]);

  const offen = reports?.filter((report) => report.status === "Neu").length ?? 0;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/admin">
              <ArrowLeft className="size-4" />
              Zurück
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-primary" />
            <h1 className="display-card text-sm uppercase">Zustandsmeldungen</h1>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="glass mb-6 rounded-2xl p-5 text-sm leading-6 text-muted-foreground">
          <p>
            Anfragen von der Seite{" "}
            <a href="/fahrzeug-zustand" className="text-primary underline underline-offset-2">
              Zustand prüfen lassen
            </a>
            . Fotos und Videos sind nicht öffentlich abrufbar — sie werden nur hier über zeitlich
            begrenzte Links angezeigt.
            {offen > 0 && (
              <>
                {" "}
                Aktuell {offen === 1 ? "ist eine Meldung" : `sind ${offen} Meldungen`} noch
                unbearbeitet.
              </>
            )}
          </p>
        </div>

        {upload && !upload.ready && (
          <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm leading-6">
            <p className="font-medium text-destructive">
              Der Foto-Upload ist auf dem Server nicht eingerichtet.
            </p>
            <p className="mt-2 text-muted-foreground">
              Kundschaft kann derzeit keine Fotos oder Videos senden — der Versuch endet mit „Der
              Upload ist derzeit nicht verfügbar“. Hier kommt dann gar keine Meldung an, was von
              außen wie eine ruhige Woche aussieht.
            </p>
            <p className="mt-2 text-muted-foreground">
              Es fehlt in <code>/etc/white-gloss/environment</code>:{" "}
              {[
                !upload.supabaseUrlSet && "SUPABASE_URL",
                !upload.serviceRoleKeySet && "SUPABASE_SERVICE_ROLE_KEY",
              ]
                .filter(Boolean)
                .join(" und ")}
              . Nach dem Eintragen den Dienst neu starten. Einzelheiten stehen in{" "}
              <code>docs/deployment.md</code>.
            </p>
          </div>
        )}

        {loadError ? (
          <div className="glass rounded-2xl border border-destructive/30 p-5 text-sm">
            <p className="text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              Erneut laden
            </Button>
          </div>
        ) : reports === null ? (
          <p className="text-sm text-muted-foreground">Wird geladen …</p>
        ) : reports.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Noch keine Meldungen eingegangen.
          </p>
        ) : (
          <ul className="space-y-4">
            {reports.map((report) => (
              <li key={report.id}>
                <ReportCard report={report} onChanged={reload} assistent={assistent} />
              </li>
            ))}
          </ul>
        )}

        {upload?.ready && <OrphanCleanup />}
      </main>
    </div>
  );
}

/**
 * SPEICHER AUFRÄUMEN
 * -------------------
 * Aufnahmen wandern schon beim Auswählen in den Speicher, damit das Absenden
 * später schnell geht. Bricht jemand danach ab, bleibt die Datei liegen.
 *
 * Bewusst zweistufig: erst zählen, dann löschen. Gelöschte Aufnahmen sind
 * unwiederbringlich weg, deshalb soll niemand versehentlich mit einem
 * einzigen Klick etwas entfernen.
 */
function OrphanCleanup() {
  const [ergebnis, setErgebnis] = useState<OrphanCleanupResult | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [erledigt, setErledigt] = useState(false);
  const aufraeumen = useServerFn(cleanupOrphanedConditionMedia);

  async function ausfuehren(loeschen: boolean) {
    setLaeuft(true);
    try {
      const r = await aufraeumen({ data: { loeschen } });
      setErgebnis(r);
      if (!loeschen) return;
      if (r.fehler) toast.error(`Nicht alles konnte entfernt werden: ${r.fehler}`);
      else {
        setErledigt(true);
        toast.success(
          r.geloescht === 0
            ? "Es gab nichts zu entfernen."
            : `${r.geloescht} Aufnahmen entfernt, ${r.megabyte} MB frei.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Das Aufräumen ist fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <section className="glass mt-10 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Trash2 aria-hidden className="size-4 text-primary" />
        <h2 className="display-card text-sm uppercase">Speicher aufräumen</h2>
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Wer Fotos auswählt und das Formular dann abbricht, hinterlässt Dateien ohne zugehörige
        Meldung. Die zählen hier nirgends mit, belegen aber Platz. Aufnahmen, die zu einer Meldung
        gehören, werden nie angefasst — ebenso wenig solche aus den letzten sieben Tagen, denn dort
        kann ein Formular noch offen sein.
      </p>

      {ergebnis && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <Kennzahl
            label="Ohne Meldung"
            wert={`${ergebnis.gefunden}${ergebnis.gefunden > 0 ? ` · ${ergebnis.megabyte} MB` : ""}`}
          />
          <Kennzahl label="Zu Meldungen gehörend" wert={String(ergebnis.inVerwendung)} />
          <Kennzahl label="Noch geschont" wert={String(ergebnis.geschont)} />
        </dl>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="outline" size="sm" loading={laeuft} onClick={() => void ausfuehren(false)}>
          Nachsehen
        </Button>
        {ergebnis && ergebnis.gefunden > 0 && !erledigt && (
          <Button
            variant="outline"
            size="sm"
            loading={laeuft}
            onClick={() => void ausfuehren(true)}
          >
            {ergebnis.gefunden} Aufnahmen endgültig löschen
          </Button>
        )}
      </div>

      {ergebnis && ergebnis.gefunden === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nichts zu tun — es liegt keine Aufnahme ohne Meldung im Speicher.
        </p>
      )}
    </section>
  );
}

function Kennzahl({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">{wert}</dd>
    </div>
  );
}

function ReportCard({
  report,
  onChanged,
  assistent,
}: {
  report: ConditionReport;
  onChanged: () => void;
  assistent: boolean;
}) {
  const [status, setStatus] = useState<ConditionStatus>(report.status);
  const [note, setNote] = useState(report.admin_note);
  const [mediaUrls, setMediaUrls] = useState<string[] | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bewertung, setBewertung] = useState<{ text: string; ausgelassen: string[] } | null>(null);
  const [bewertungLaeuft, setBewertungLaeuft] = useState(false);

  const fetchMedia = useServerFn(getConditionPhotoUrls);
  const update = useServerFn(updateConditionReport);
  const remove = useServerFn(deleteConditionReport);
  const bewerten = useServerFn(assessConditionPhotos);

  async function showMedia() {
    if (mediaUrls || loadingMedia) return;
    setLoadingMedia(true);
    try {
      setMediaUrls(await fetchMedia({ data: { id: report.id } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Medien konnten nicht geladen werden.");
    } finally {
      setLoadingMedia(false);
    }
  }

  async function fotosBewerten() {
    setBewertungLaeuft(true);
    try {
      setBewertung(await bewerten({ data: { reportId: report.id } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Die Einschätzung ist fehlgeschlagen.");
    } finally {
      setBewertungLaeuft(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await update({ data: { id: report.id, status, adminNote: note } });
      toast.success("Gespeichert.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Meldung von „${report.customer_name}" mit allen Fotos/Videos endgültig löschen?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await remove({ data: { id: report.id } });
      if (result.storageWarning) {
        toast.warning("Meldung gelöscht, einzelne Medien konnten aber nicht entfernt werden.");
      } else {
        toast.success("Meldung gelöscht.");
      }
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const geaendert = status !== report.status || note !== report.admin_note;

  return (
    <article className="glass rounded-2xl p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs ${statusStyles[report.status]}`}
            >
              {report.status}
            </span>
            <time dateTime={report.created_at} className="text-xs text-muted-foreground">
              {formatDateTime(report.created_at)}
            </time>
            {report.invoice_number && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                zur Buchung {report.invoice_number}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-sm font-medium text-foreground">
            {report.customer_name}
            {report.vehicle && (
              <span className="font-normal text-muted-foreground"> · {report.vehicle}</span>
            )}
            {report.plate && (
              <span className="font-normal text-muted-foreground"> · {report.plate}</span>
            )}
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <a
              href={`mailto:${report.customer_email}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Mail aria-hidden className="size-3.5" />
              {report.customer_email}
            </a>
            {report.customer_phone && (
              <a
                href={`tel:${report.customer_phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Phone aria-hidden className="size-3.5" />
                {report.customer_phone}
              </a>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          loading={busy}
          aria-label={`Meldung von ${report.customer_name} löschen`}
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </header>

      {report.condition_text ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {report.condition_text}
        </p>
      ) : (
        <p className="mt-4 text-sm italic text-muted-foreground">
          Keine zusätzliche Beschreibung — bitte Aufnahmen prüfen.
        </p>
      )}

      {report.photo_paths.length > 0 && (
        <div className="mt-5">
          {mediaUrls === null ? (
            <Button
              variant="outline"
              size="sm"
              onClick={showMedia}
              loading={loadingMedia}
              className="gap-1.5"
            >
              <Images className="size-3.5" />
              {report.photo_paths.length}{" "}
              {report.photo_paths.length === 1 ? "Aufnahme ansehen" : "Aufnahmen ansehen"}
            </Button>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mediaUrls.map((url, index) => {
                const path = report.photo_paths[index] ?? "";
                const video = isVideoPath(path);
                return (
                  <li key={`${path}-${url}`} className="min-w-0">
                    {video ? (
                      <div className="overflow-hidden rounded-xl border border-border/60 bg-black/20">
                        <video
                          src={url}
                          controls
                          playsInline
                          preload="metadata"
                          className="aspect-video w-full bg-black object-contain"
                          aria-label={`Zustandsvideo ${index + 1} von ${report.customer_name}`}
                        />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-3 py-2 text-xs text-primary underline underline-offset-2"
                        >
                          Video separat öffnen
                        </a>
                      </div>
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Foto ${index + 1} von ${report.customer_name}`}
                          loading="lazy"
                          decoding="async"
                          className="aspect-video w-full rounded-xl border border-border/60 object-cover transition-opacity hover:opacity-85"
                        />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {assistent && bildAnzahl(report.photo_paths) > 0 && (
        <div className="mt-5">
          {bewertung === null ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={fotosBewerten}
                loading={bewertungLaeuft}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5" />
                Grobkalkulation aus den Fotos
              </Button>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Liefert eine Liste der Arbeitsschritte mit Zeitansatz und eine grobe Preisspanne,
                gerechnet mit Ihrer hinterlegten Preisliste. Die Fotos werden dafür einmalig an den
                KI-Dienst übertragen. Es bleibt eine Schätzung nach Bildern — keine Begutachtung,
                und nichts davon geht an die Kundschaft.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
                <Sparkles aria-hidden className="size-3.5" />
                Grobkalkulation — Schätzung nach Fotos, keine verbindliche Zusage
              </p>

              {bewertung.ausgelassen.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs font-medium text-amber-300">
                    Nicht in die Einschätzung eingeflossen:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {bewertung.ausgelassen.map((zeile) => (
                      <li key={zeile} className="text-xs leading-5 text-muted-foreground">
                        {zeile}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                {bewertung.text}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNote(note ? `${note}\n\n${bewertung.text}` : bewertung.text)}
                >
                  In die interne Notiz übernehmen
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setBewertung(null)}>
                  Ausblenden
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-border/60 pt-4">
        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ConditionStatus)}
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40"
            >
              {CONDITION_STATUSES.map((wert) => (
                <option key={wert} value={wert}>
                  {wert}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Interne Notiz
            </span>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="z. B. Angebot über mehrstufige Politur geschickt"
              className="mt-1.5 bg-secondary/40"
            />
          </label>
        </div>

        {geaendert && (
          <Button size="sm" className="mt-3" onClick={save} loading={busy}>
            Speichern
          </Button>
        )}
      </div>
    </article>
  );
}
