import { useCallback, useEffect, useRef, useState } from "react";
import {
  archiveCmsMedia,
  listCmsMedia,
  updateCmsMedia,
  uploadCmsImage,
} from "@/lib/studio-media.functions";
import type { StudioAsset, StudioMedia } from "@/lib/studio-media.model";
import { Button, inputClass } from "./ui";

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Die Bilder konnten nicht verarbeitet werden. Bitte erneut versuchen.";

function MediaDetails({
  media,
  onChanged,
  onSelect,
  disabled,
}: {
  media: StudioMedia;
  onChanged: () => Promise<void>;
  onSelect: (asset: StudioAsset) => void;
  disabled: boolean;
}) {
  const [alt, setAlt] = useState(media.alt);
  const [caption, setCaption] = useState(media.caption);
  const [approved, setApproved] = useState(media.approved);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const unsaved = alt !== media.alt || caption !== media.caption || approved !== media.approved;
  async function save(archive: boolean) {
    setBusy(true);
    setError("");
    try {
      if (archive)
        await archiveCmsMedia({ data: { id: media.id, expectedVersion: media.version } });
      else
        await updateCmsMedia({
          data: { id: media.id, expectedVersion: media.version, alt, caption, approved },
        });
      await onChanged();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="min-w-0 space-y-4 rounded-md border border-line bg-surface p-4">
      <img
        src={media.previewUrl}
        alt={media.alt || "Noch ohne Bildbeschreibung"}
        width={media.width}
        height={media.height}
        loading="lazy"
        className="aspect-[4/3] w-full rounded object-contain"
      />
      <div>
        <p className="break-all font-medium">{media.originalName}</p>
        <p className="text-sm text-muted">
          {media.width} × {media.height} px · {Math.round(media.bytes / 1024)} KB ·{" "}
          {media.approved ? "Freigegeben" : "Privater Entwurf"}
        </p>
      </div>
      <fieldset disabled={busy || disabled} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span>Bildbeschreibung (Alt-Text)</span>
          <input
            className={inputClass}
            value={alt}
            maxLength={300}
            onChange={(event) => setAlt(event.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Bildunterschrift</span>
          <input
            className={inputClass}
            value={caption}
            maxLength={500}
            onChange={(event) => setCaption(event.target.value)}
          />
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-current"
            checked={approved}
            onChange={(event) => setApproved(event.target.checked)}
          />
          <span>
            Ich darf dieses Bild öffentlich verwenden. Personen und Kennzeichen sind geklärt.
          </span>
        </label>
        <p className="text-xs leading-relaxed text-muted">
          Das Bild wird erst mit einer veröffentlichten Seite öffentlich erreichbar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => void save(false)}>
            Bildangaben speichern
          </Button>
          <Button
            type="button"
            disabled={unsaved}
            onClick={() =>
              onSelect({
                id: media.id,
                src: media.publicUrl,
                previewSrc: media.previewUrl,
                width: media.width,
                height: media.height,
                alt: media.alt,
                caption: media.caption,
              })
            }
          >
            Zur Seite hinzufügen
          </Button>
          <Button type="button" variant="line" onClick={() => setConfirmArchive(!confirmArchive)}>
            Bild entfernen
          </Button>
        </div>
        {unsaved && (
          <p className="text-sm text-muted">
            Bitte die Bildangaben speichern, bevor Sie dieses Bild zur Seite hinzufügen.
          </p>
        )}
        {confirmArchive && (
          <div className="space-y-3 border-t border-line pt-3">
            <p className="text-sm">
              Dieses Bild wird auch auf bereits veröffentlichten Seiten gesperrt. Frühere
              Seitenversionen können es danach nicht erneut veröffentlichen.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmArchive(false)}>
                Behalten
              </Button>
              <Button type="button" onClick={() => void save(true)}>
                Bild jetzt sperren
              </Button>
            </div>
          </div>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

export function WebsiteStudioMedia({
  onSelect,
  onAssetsChanged,
  disabled = false,
}: {
  onSelect: (asset: StudioAsset) => void;
  onAssetsChanged: (assets: StudioAsset[]) => void;
  disabled?: boolean;
}) {
  const [uploads, setUploads] = useState<StudioMedia[]>([]);
  const [catalog, setCatalog] = useState<StudioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const onAssets = useRef(onAssetsChanged);
  onAssets.current = onAssetsChanged;
  const reload = useCallback(async () => {
    const result = await listCmsMedia();
    setUploads(result.uploads);
    setCatalog(result.catalog);
    onAssets.current([
      ...result.catalog,
      ...result.uploads
        .filter((media) => !media.archivedAt)
        .map((media) => ({
          id: media.id,
          src: media.publicUrl,
          previewSrc: media.previewUrl,
          width: media.width,
          height: media.height,
          alt: media.alt,
          caption: media.caption,
        })),
    ]);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void reload()
      .catch((error) => {
        if (!cancelled) setError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);
  async function upload(files: FileList | null) {
    if (!files?.length || disabled || uploadLock.current) return;
    if (files.length > 5) {
      setError("Bitte höchstens fünf Bilder auf einmal auswählen.");
      return;
    }
    const batch = [...files];
    if (
      batch.some(
        (file) =>
          file.size > 12 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      setError(
        "Erlaubt sind JPEG, PNG und WebP bis 12 MB je Bild. HEIC-Bilder bitte vorher als JPEG exportieren.",
      );
      return;
    }
    uploadLock.current = true;
    setUploading(true);
    setError("");
    let completed = 0;
    try {
      for (const file of batch) {
        setStatus(`Bild ${completed + 1} von ${batch.length} wird geprüft und optimiert …`);
        const data = new FormData();
        data.set("file", file);
        await uploadCmsImage({ data });
        completed++;
      }
      setStatus(
        `${completed} ${completed === 1 ? "Bild wurde" : "Bilder wurden"} als privater Entwurf hochgeladen.`,
      );
    } catch (error) {
      setError(errorMessage(error));
      setStatus(`${completed} von ${batch.length} Bildern hochgeladen.`);
    } finally {
      try {
        await reload();
      } catch (error) {
        setError(errorMessage(error));
      }
      uploadLock.current = false;
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section className="space-y-6" aria-label="Bilderverwaltung" aria-busy={loading || uploading}>
      <div
        className="rounded-md border border-dashed border-line bg-surface p-6"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(event.dataTransfer.files);
        }}
      >
        <h2 className="font-display text-2xl">Öffentliche Website-Bilder</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Bilder hierher ziehen oder auswählen. Neue Bilder bleiben zunächst privat. Kundenfotos aus
          Aufträgen werden hier nicht übernommen.
        </p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void upload(event.target.files)}
          aria-label="Website-Bilder auswählen"
          disabled={disabled || uploading}
        />
        <Button
          type="button"
          className="mt-4"
          disabled={disabled || uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? "Bilder werden verarbeitet …" : "Bilder auswählen"}
        </Button>
        <p className="mt-3 text-xs text-muted">
          JPEG, PNG, WebP · bis 12 MB und 40 Megapixel · maximal 5 Bilder je Auswahl
        </p>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted">
        {status || (loading ? "Bilder werden geladen …" : "")}
      </p>
      {error && (
        <div role="alert" className="space-y-2 text-sm text-danger">
          <p>{error}</p>
          <Button
            type="button"
            variant="ghost"
            disabled={loading || uploading}
            onClick={() => {
              setError("");
              void reload().catch((error) => setError(errorMessage(error)));
            }}
          >
            Bilder erneut laden
          </Button>
        </div>
      )}
      {uploads.filter((media) => !media.archivedAt).length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {uploads
            .filter((media) => !media.archivedAt)
            .map((media) => (
              <MediaDetails
                key={`${media.id}-${media.version}`}
                media={media}
                onChanged={reload}
                onSelect={onSelect}
                disabled={disabled || uploading}
              />
            ))}
        </ul>
      )}
      <div>
        <h3 className="font-display text-2xl">Bereits freigegebene Motive</h3>
        <p className="mt-2 text-sm text-muted">
          Diese Bilder gehören bereits zur öffentlichen Website.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {catalog.map((asset) => (
          <li key={asset.id} className="min-w-0 space-y-3">
            <img
              src={asset.previewSrc}
              alt={asset.alt}
              width={asset.width}
              height={asset.height}
              loading="lazy"
              className="aspect-[4/3] w-full rounded object-contain"
            />
            <p className="text-sm text-muted">{asset.alt}</p>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={disabled || uploading}
              onClick={() => onSelect(asset)}
            >
              Bild auswählen
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
