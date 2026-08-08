import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Images, Loader2, X } from "lucide-react";
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
   * Meldet nach außen, ob gerade hochgeladen wird. Im Buchungsassistenten
   * wird derselbe Kanal zusätzlich genutzt, um den Pflicht-Fotostatus zu
   * sperren: Ohne mindestens ein Foto bleibt „Weiter“ deaktiviert.
   */
  onUploadingChange?: (uploading: boolean) => void;
  /** Eigene ID, falls die Komponente mehrfach auf einer Seite steht. */
  inputId?: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const upload = useServerFn(uploadConditionPhoto);

  // Nur im Buchungsassistenten ist mindestens ein aktuelles Zustandsfoto
  // Pflicht. Die eigenständige Zustandsseite behält ihre bisherige Logik.
  const photoRequired = inputId === "buchung-zustand-fotos";
  const requirementMissing = photoRequired && photos.length === 0;

  useEffect(() => {
    onUploadingChange?.(uploading || requirementMissing);
  }, [onUploadingChange, requirementMissing, uploading]);

  // Der bisherige Buchungsassistent bezeichnete diesen Schritt noch als
  // optional. Solange die Pflichtlogik in dieser gemeinsamen Komponente
  // sitzt, halten wir die sichtbaren Texte im Buchungsschritt synchron.
  useEffect(() => {
    if (!photoRequired) return;
    const input = document.getElementById(inputId);
    const section = input?.closest("section");
    if (!section) return;

    const heading = section.querySelector("h3");
    if (heading) heading.textContent = "Fahrzeugzustand";

    const headerText = heading?.parentElement?.querySelector("p");
    if (headerText) {
      headerText.textContent =
        "Bitte nehmen Sie mindestens ein aktuelles Foto Ihres Fahrzeugs auf. So können wir den Zustand und den Aufwand vor der Terminbestätigung realistisch einschätzen.";
    }

    const paragraphs = Array.from(section.querySelectorAll(":scope > p"));
    const optionalHint = paragraphs.find((element) =>
      element.textContent?.includes("Dieser Schritt ist freiwillig"),
    );
    if (optionalHint) {
      optionalHint.textContent =
        "Mindestens ein Fahrzeugfoto ist für die Buchungsanfrage erforderlich. Eine zusätzliche Zustandsbeschreibung ist freiwillig.";
    }
  }, [inputId, photoRequired]);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    const frei = MAX_PHOTOS - photos.length;
    if (frei <= 0) {
      toast.error(`Es sind höchstens ${MAX_PHOTOS} Fotos möglich.`);
      input.value = "";
      return;
    }

    setUploading(true);
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
    setUploading(false);
    input.value = "";
  }

  function removePhoto(path: string) {
    const entfernt = photos.find((photo) => photo.path === path);
    if (entfernt) URL.revokeObjectURL(entfernt.previewUrl);
    onChange(photos.filter((photo) => photo.path !== path));
  }

  const disabled = uploading || photos.length >= MAX_PHOTOS;
  const cameraInputId = `${inputId}-camera`;
  const galleryInputId = `${inputId}-gallery`;

  return (
    <div className="space-y-4">
      {photoRequired && (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            requirementMissing
              ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
          ].join(" ")}
          role={requirementMissing ? "alert" : "status"}
        >
          {requirementMissing
            ? "Pflichtangabe: Bitte nehmen Sie mindestens ein aktuelles Foto des Fahrzeugs auf."
            : "Fahrzeugzustand erfasst – Sie können weitere Fotos ergänzen oder fortfahren."}
        </div>
      )}

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

      {/*
       * capture="environment" öffnet auf unterstützten Smartphones direkt
       * die rückseitige Kamera. Ein zweiter Eingang bleibt für vorhandene
       * Galerie-Bilder und Desktop-Nutzer erhalten.
       */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFiles}
        disabled={disabled}
        aria-label="Foto mit der Kamera aufnehmen"
        className="hidden"
        id={cameraInputId}
      />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFiles}
        disabled={disabled}
        aria-label="Fotos aus der Galerie auswählen"
        className="hidden"
        id={galleryInputId}
      />

      {/* Beibehalten für die DOM-Zuordnung des Buchungsschritts. */}
      <span id={inputId} className="sr-only" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          asChild
          type="button"
          variant={photoRequired ? "default" : "outline"}
          disabled={disabled}
          className="gap-2"
        >
          <label htmlFor={cameraInputId} className="cursor-pointer">
            {uploading ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Camera aria-hidden className="size-4" />
            )}
            {uploading ? "Wird hochgeladen …" : "Foto aufnehmen"}
          </label>
        </Button>

        <Button asChild type="button" variant="outline" disabled={disabled} className="gap-2">
          <label htmlFor={galleryInputId} className="cursor-pointer">
            <Images aria-hidden className="size-4" />
            Aus Galerie wählen
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
