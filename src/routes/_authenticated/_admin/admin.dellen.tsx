import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarDays, Images, Mail, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteDentRepairRequest,
  getDentRepairPhotoUrls,
  listDentRepairRequests,
  updateDentRepairRequest,
  type DentRepairRequest,
} from "@/lib/dentRepair.functions";
import {
  DENT_REPAIR_PRICE_LABEL,
  dentRequestStatuses,
  type DentRequestStatus,
} from "@/lib/dentRepair";

export const Route = createFileRoute("/_authenticated/_admin/admin/dellen")({
  head: () => ({
    meta: [
      { title: "Dellen- & Hagelschaden-Anfragen – White Gloss" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DentAdminPage,
});

function date(value: string) {
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE", {
    dateStyle: "full",
  });
}

function DentAdminPage() {
  const fetchAll = useServerFn(listDentRepairRequests);
  const [requests, setRequests] = useState<DentRepairRequest[] | null>(null);
  const reload = useCallback(
    () =>
      void fetchAll({})
        .then(setRequests)
        .catch((error) =>
          toast.error(error instanceof Error ? error.message : "Laden fehlgeschlagen."),
        ),
    [fetchAll],
  );
  useEffect(reload, [reload]);
  return (
    <main id="main-content" className="min-h-dvh bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/einstellungen">
            <ArrowLeft className="size-4" /> Zurück
          </Link>
        </Button>
        <p className="eyebrow mt-8">Begutachtungsanfragen</p>
        <h1 className="display-section mt-2 uppercase">Dellen & Hagelschäden</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Eigenständige Anfragen ohne Paket und ohne Preis. Fotos werden erst beim Öffnen über
          private, zeitlich begrenzte Links geladen.
        </p>
        {requests === null ? (
          <p className="mt-8 text-muted-foreground">Wird geladen …</p>
        ) : requests.length === 0 ? (
          <p className="glass mt-8 rounded-2xl p-8 text-center text-muted-foreground">
            Noch keine Anfragen.
          </p>
        ) : (
          <ul className="mt-8 space-y-5">
            {requests.map((request) => (
              <li key={request.id}>
                <DentCard request={request} reload={reload} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function DentCard({ request, reload }: { request: DentRepairRequest; reload: () => void }) {
  const getPhotos = useServerFn(getDentRepairPhotoUrls);
  const update = useServerFn(updateDentRepairRequest);
  const remove = useServerFn(deleteDentRepairRequest);
  const [urls, setUrls] = useState<string[] | null>(null);
  const [status, setStatus] = useState<DentRequestStatus>(request.status);
  const [adminNote, setAdminNote] = useState(request.admin_note);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await update({ data: { id: request.id, status, adminNote } });
      toast.success("Gespeichert.");
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteRequest() {
    if (!window.confirm(`Anfrage ${request.reference} einschließlich Fotos endgültig löschen?`))
      return;
    setBusy(true);
    try {
      const result = await remove({ data: { id: request.id } });
      if (result.storageWarning) {
        toast.warning("Anfrage gelöscht, einzelne Fotos konnten nicht entfernt werden.");
      } else {
        toast.success("Anfrage gelöscht.");
      }
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="glass rounded-3xl p-5 sm:p-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              {request.status}
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              {request.reference}
            </span>
          </div>
          <h2 className="display-card mt-3 uppercase">
            {request.damage_type} · {request.vehicle_make} {request.vehicle_model}
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <a
              href={`mailto:${request.customer_email}`}
              className="inline-flex items-center gap-1.5 hover:text-primary"
            >
              <Mail className="size-3.5" />
              {request.customer_name} · {request.customer_email}
            </a>
            <a
              href={`tel:${request.customer_phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1.5 hover:text-primary"
            >
              <Phone className="size-3.5" />
              {request.customer_phone}
            </a>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={deleteRequest}
          loading={busy}
          className="text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </header>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Fahrzeugbereich" value={request.vehicle_area} />
        <Info label="Anzahl / Größe" value={`${request.dent_count} / ${request.dent_size}`} />
        <Info
          label="Begutachtung"
          value={`${request.assessment_mode} · ${date(request.preferred_date)}`}
          icon
        />
        <Info label="Preis" value={DENT_REPAIR_PRICE_LABEL} />
        <Info
          label="Fotos"
          value={`${request.photo_paths.length} Aufnahme${request.photo_paths.length === 1 ? "" : "n"}`}
        />
      </dl>
      {request.note && (
        <p className="mt-5 whitespace-pre-wrap rounded-xl bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
          {request.note}
        </p>
      )}
      {request.photo_paths.length > 0 && (
        <div className="mt-5">
          {urls === null ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  setUrls(await getPhotos({ data: { id: request.id } }));
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Fotos konnten nicht geladen werden.",
                  );
                }
              }}
            >
              <Images className="size-4" /> Fotos ansehen
            </Button>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {urls.map((url, index) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt={`Schadensfoto ${index + 1} zu ${request.reference}`}
                      className="aspect-video w-full rounded-xl border border-border object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
        <label>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DentRequestStatus)}
            className="mt-2 h-11 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm"
          >
            {dentRequestStatuses.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Interne Notiz
          </span>
          <Textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            maxLength={2000}
            rows={2}
            className="mt-2 bg-secondary/40"
          />
        </label>
        <Button onClick={save} loading={busy}>
          Speichern
        </Button>
      </div>
    </article>
  );
}

function Info({ label, value, icon = false }: { label: string; value: string; icon?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
        {icon && <CalendarDays className="size-3.5 text-primary" />}
        {label}
      </dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
