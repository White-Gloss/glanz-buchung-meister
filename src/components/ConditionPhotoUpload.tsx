import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  uploadConditionPhoto,
  MAX_PHOTOS,
  MAX_IMAGE_BYTES,
} from "@/lib/conditionReports.functions";

/**
 * FOTO-UPLOAD FÜR ZUSTANDSMELDUNGEN
 * ----------------------------------
 * Wird an zwei Stellen verwendet: im Buchungsassistenten als eigener
 * Schritt und auf der eigenständigen Seite /fahrzeug-zustand. Deshalb als
 * gemeinsame Komponente — sonst müsste die Upload-Logik samt Fehlerfällen
 * doppelt gepflegt werden.
 *
 * Die hochgeladenen Dateien landen sofort im privaten Speicher; die
 * Komponente gibt nur die Storage-Pfade nach außen. Erst beim Absenden
 * des jeweiligen Formulars werden sie einer Meldung zugeordnet.
 */

export type UploadedPhoto = {
  path: string;
  /** Lokale Vorschau (blob:) — der Speicher selbst ist nicht öffentlich. */
  previewUrl: string;
  name: string;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Die Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

export function ConditionPhotoUpload({
  photos,
  onChange,
  onUploadingChange,
  inputId = "zustand-fotos",
  hint,
}: {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  /**
   * Meldet nach außen, ob gerade hochgeladen wird. Die umgebenden
   * Formulare sperren damit „Absenden“ beziehungsweise „Weiter“ — sonst
   * ginge ein Foto verloren, das noch unterwegs ist.
   */
  onUploadingChange?: (uploading: boolean) => void;
  /** Eigene ID, falls die Komponente mehrfach auf einer Seite steht. */
  inputId?: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);

  function setUploadingState(wert: boolean) {
    setUploading(wert);
    onUploadingChange?.(wert);
  }
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadConditionPhoto);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const frei = MAX_PHOTOS - photos.length;
    if (frei <= 0) {
      toast.error(`Es sind höchstens ${MAX_PHOTOS} Fotos möglich.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingState(true);
    const neue: UploadedPhoto[] = [];

    // Nacheinander statt parallel: mehrere große Bilder gleichzeitig
    // lassen den Upload auf Mobilfunkverbindungen häufig scheitern.
    for (const file of files.slice(0, frei)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`„${file.name}“ ist kein JPEG, PNG oder WebP.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`„${file.name}“ ist größer als 8 MB.`);
        continue;
      }
      try {
        const base64Data = await fileToBase64(file);
        const result = await upload({
          data: { fileName: file.name, contentType: file.type, base64Data },
        });
        neue.push({
          path: result.path,
          previewUrl: URL.createObjectURL(file),
          name: file.name,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : `„${file.name}“ konnte nicht geladen werden.`,
        );
      }
    }

    if (neue.length > 0) onChange([...photos, ...neue]);
    if (files.length > frei) {
      toast.warning(`Nur die ersten ${frei} Fotos wurden übernommen.`);
    }
    setUploadingState(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(path: string) {
    const entfernt = photos.find((photo) => photo.path === path);
    if (entfernt) URL.revokeObjectURL(entfernt.previewUrl);
    onChange(photos.filter((photo) => photo.path !== path));
  }

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.path} className="relative">
              <div className="aspect-square overflow-hidden rounded-xl border border-border/60 bg-secondary/30">
                <img
                  src={photo.previewUrl}
                  alt={`Vorschau: ${photo.name}`}
                  className="size-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(photo.path)}
                aria-label={`${photo.name} entfernen`}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFiles}
        disabled={uploading || photos.length >= MAX_PHOTOS}
        aria-label="Fotos auswählen"
        className="hidden"
        id={inputId}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          asChild
          type="button"
          variant="outline"
          disabled={uploading || photos.length >= MAX_PHOTOS}
          className="gap-2"
        >
          <label htmlFor={inputId} className="cursor-pointer">
            {uploading ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <ImagePlus aria-hidden className="size-4" />
            )}
            {uploading ? "Wird hochgeladen …" : "Fotos auswählen"}
          </label>
        </Button>
        <p className="text-xs text-muted-foreground">
          {photos.length} von {MAX_PHOTOS} · JPEG, PNG oder WebP · bis 8 MB je Bild
        </p>
      </div>

      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}
