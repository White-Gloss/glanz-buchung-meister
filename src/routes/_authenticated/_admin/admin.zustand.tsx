import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Camera, Images, Mail, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  listConditionReports,
  getConditionPhotoUrls,
  updateConditionReport,
  deleteConditionReport,
  CONDITION_STATUSES,
  type ConditionReport,
  type ConditionStatus,
} from "@/lib/conditionReports.functions";
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

function ConditionAdminPage() {
  const [reports, setReports] = useState<ConditionReport[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchAll = useServerFn(listConditionReports);

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
                <ReportCard report={report} onChanged={reload} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ReportCard({ report, onChanged }: { report: ConditionReport; onChanged: () => void }) {
  const [status, setStatus] = useState<ConditionStatus>(report.status);
  const [note, setNote] = useState(report.admin_note);
  const [mediaUrls, setMediaUrls] = useState<string[] | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchMedia = useServerFn(getConditionPhotoUrls);
  const update = useServerFn(updateConditionReport);
  const remove = useServerFn(deleteConditionReport);

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
