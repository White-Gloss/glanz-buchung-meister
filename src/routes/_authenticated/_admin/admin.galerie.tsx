import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, EyeOff, ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listAllGalleryItems,
  uploadGalleryImage,
  updateGalleryItem,
  deleteGalleryItem,
  galleryPublicUrl,
  type GalleryItemRow,
} from "@/lib/gallery.functions";
import { servicePages } from "@/lib/servicePages";
import { diagnoseBackendError } from "@/lib/backendErrors";
import { SupabaseConfigNotice } from "@/components/SupabaseConfigNotice";
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";

export const Route = createFileRoute("/_authenticated/_admin/admin/galerie")({
  head: () => ({
    meta: [
      { title: "Fahrzeuggalerie – White Gloss Detailing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GalleryRoute,
  errorComponent: ({ error }) => <SupabaseConfigNotice info={diagnoseBackendError(error)} />,
});

function GalleryRoute() {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return <SupabaseConfigNotice missing={config.missing} />;
  return <GalleryPage />;
}

const MAX_BYTES = 8 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // "data:image/jpeg;base64,AAAA..." -> nur den Teil nach dem Komma senden
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function GalleryPage() {
  const [items, setItems] = useState<GalleryItemRow[] | null>(null);
  const fetchAll = useServerFn(listAllGalleryItems);

  function reload() {
    void fetchAll({}).then(setItems);
  }
  useEffect(reload, [fetchAll]);

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
            <ImageIcon className="size-4 text-primary" />
            <h1 className="display-card text-sm uppercase">Fahrzeuggalerie</h1>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="glass mb-6 rounded-2xl p-5 text-sm leading-6 text-muted-foreground">
          <p>
            Bilder von aufbereiteten Fahrzeugen hochladen — sie erscheinen dann in der Galerie auf
            der Startseite. Bis zu 8 MB je Bild, im Format JPEG, PNG oder WebP.
          </p>
        </div>

        <UploadForm onUploaded={reload} />

        {items === null ? (
          <p className="mt-6 text-sm text-muted-foreground">Wird geladen …</p>
        ) : items.length === 0 ? (
          <p className="glass mt-6 rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Noch keine Bilder hochgeladen.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <GalleryCard key={item.id} item={item} onChanged={reload} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [title, setTitle] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [serviceSlug, setServiceSlug] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadGalleryImage);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Nur JPEG, PNG oder WebP werden unterstützt.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Datei ist größer als 8 MB.");
      return;
    }

    setUploading(true);
    try {
      const base64Data = await fileToBase64(file);
      await upload({
        data: {
          fileName: file.name,
          contentType: file.type,
          base64Data,
          title: title.trim() || file.name,
          vehicle: vehicle.trim(),
          serviceSlug: serviceSlug || null,
        },
      });
      toast.success("Bild hochgeladen.");
      setTitle("");
      setVehicle("");
      setServiceSlug("");
      onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hochladen fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="glass space-y-4 rounded-2xl p-5">
      <h2 className="display-card text-sm uppercase">Neues Bild hochladen</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Titel (optional)
          </p>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Keramikversiegelung nach dem Finish"
            className="mt-1.5 bg-secondary/40"
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Fahrzeug (optional)
          </p>
          <Input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="z. B. VW Golf 8"
            className="mt-1.5 bg-secondary/40"
          />
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Zugehörige Leistung (optional)
        </p>
        <select
          value={serviceSlug}
          onChange={(e) => setServiceSlug(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Keine Zuordnung</option>
          {servicePages.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
        id="gallery-file-input"
      />
      <Button asChild loading={uploading} className="gap-1.5">
        <label htmlFor="gallery-file-input" className="cursor-pointer">
          <Upload className="size-4" />
          {uploading ? "Wird hochgeladen …" : "Bild auswählen und hochladen"}
        </label>
      </Button>
    </div>
  );
}

function GalleryCard({ item, onChanged }: { item: GalleryItemRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const update = useServerFn(updateGalleryItem);
  const remove = useServerFn(deleteGalleryItem);

  async function togglePublished() {
    setBusy(true);
    try {
      await update({
        data: {
          id: item.id,
          title: item.title,
          vehicle: item.vehicle,
          serviceSlug: item.service_slug,
          isPublished: !item.is_published,
          sortOrder: item.sort_order,
        },
      });
      onChanged();
    } catch {
      toast.error("Konnte Status nicht ändern.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`„${item.title || "Dieses Bild"}“ wirklich endgültig löschen?`)) return;
    setBusy(true);
    try {
      await remove({ data: { id: item.id, storagePath: item.storage_path } });
      toast.success("Bild gelöscht.");
      onChanged();
    } catch {
      toast.error("Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="glass overflow-hidden rounded-2xl">
      <div className="aspect-video bg-secondary/30">
        <img
          src={galleryPublicUrl(item.storage_path)}
          alt={item.title || "Fahrzeugfoto"}
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
      <div className="p-4">
        <p className="truncate text-sm font-medium text-foreground">{item.title || "Ohne Titel"}</p>
        {item.vehicle && <p className="truncate text-xs text-muted-foreground">{item.vehicle}</p>}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={togglePublished}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {item.is_published ? (
              <>
                <Eye className="size-3.5" /> live
              </>
            ) : (
              <>
                <EyeOff className="size-3.5" /> Entwurf
              </>
            )}
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            loading={busy}
            className="gap-1.5 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}
