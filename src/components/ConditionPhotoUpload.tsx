import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Images, Loader2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  uploadConditionPhoto,
  MAX_PHOTOS,
  MAX_MEDIA_BYTES,
} from "@/lib/conditionReports.functions";

/**
 * MEDIEN-UPLOAD FÜR ZUSTANDSMELDUNGEN
 * ------------------------------------
 * Wird im Buchungsassistenten und auf /fahrzeug-zustand verwendet.
 * Fotos werden bei Bedarf vor dem Upload im Browser verkleinert. Größere
 * Videos werden – sofern der Browser captureStream + MediaRecorder anbietet –
 * lokal mit geringerer Bitrate neu codiert. So landen nur bereits reduzierte
 * Dateien im privaten Storage und große Handyaufnahmen laufen nicht unnötig
 * durch den App-Server.
 */

export type UploadedPhoto = {
  path: string;
  /** Lokale Vorschau (blob:) — der Storage selbst bleibt privat. */
  previewUrl: string;
  name: string;
  kind: "image" | "video";
  sizeBytes: number;
};

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const IMAGE_COMPRESSION_TRIGGER = 4 * 1024 * 1024;
const IMAGE_TARGET_BYTES = 3 * 1024 * 1024;
const VIDEO_TARGET_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_SOURCE_BYTES = 120 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 90;

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Die Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Das Foto konnte nicht verkleinert werden."))),
      "image/jpeg",
      quality,
    );
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Das Fotoformat kann auf diesem Gerät nicht gelesen werden."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressImage(file: File): Promise<File> {
  const image = await loadImage(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  const maxDimension = 2200;
  let scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
  let quality = 0.84;
  let result: Blob | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(originalWidth * scale));
    canvas.height = Math.max(1, Math.round(originalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Die Bildverkleinerung wird auf diesem Gerät nicht unterstützt.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    result = await canvasToJpeg(canvas, quality);
    canvas.width = 1;
    canvas.height = 1;

    if (result.size <= IMAGE_TARGET_BYTES || result.size <= MAX_MEDIA_BYTES * 0.72) break;
    if (quality > 0.58) quality -= 0.12;
    else {
      scale *= 0.78;
      quality = 0.72;
    }
  }

  if (!result) throw new Error("Das Foto konnte nicht verkleinert werden.");
  if (result.size >= file.size && ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= MAX_MEDIA_BYTES) {
    return file;
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "fahrzeug";
  return new File([result], `${base}-optimiert.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

type CaptureVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  webkitCaptureStream?: () => MediaStream;
};

async function videoDuration(file: File): Promise<{ video: CaptureVideo; url: string; duration: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video") as CaptureVideo;
  video.preload = "metadata";
  video.playsInline = true;
  video.muted = true;
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Das Videoformat kann auf diesem Gerät nicht gelesen werden."));
  });
  const duration = Number(video.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    throw new Error("Die Videolänge konnte nicht bestimmt werden.");
  }
  return { video, url, duration };
}

function bestRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

async function compressVideo(file: File): Promise<File> {
  if (file.size > MAX_VIDEO_SOURCE_BYTES) {
    throw new Error(`Das Video ist mit ${mb(file.size)} zu groß. Bitte nehmen Sie ein kürzeres Video auf.`);
  }

  const { video, url, duration } = await videoDuration(file);
  let stream: MediaStream | null = null;
  try {
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new Error("Bitte beschränken Sie das Zustandsvideo auf höchstens 90 Sekunden.");
    }

    const capture = video.captureStream?.bind(video) ?? video.webkitCaptureStream?.bind(video);
    const mimeType = bestRecorderMime();
    if (!capture || !mimeType) {
      throw new Error(
        `Das Video ist größer als ${mb(MAX_MEDIA_BYTES)} und kann auf diesem Gerät nicht automatisch verkleinert werden. Bitte nehmen Sie ein kürzeres Video auf.`,
      );
    }

    const targetBitsPerSecond = Math.max(
      320_000,
      Math.min(1_800_000, Math.floor((VIDEO_TARGET_BYTES * 8 * 0.9) / duration) - 64_000),
    );

    stream = capture();
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: targetBitsPerSecond,
      audioBitsPerSecond: 64_000,
    });

    const output = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Das Video konnte nicht verkleinert werden."));
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
    });

    const ended = new Promise<void>((resolve, reject) => {
      video.onended = () => resolve();
      video.onerror = () => reject(new Error("Das Video konnte nicht verarbeitet werden."));
    });

    recorder.start(1000);
    await video.play();
    await ended;
    recorder.stop();
    const blob = await output;

    if (blob.size === 0 || blob.size > MAX_MEDIA_BYTES) {
      throw new Error(
        `Das verkleinerte Video ist noch größer als ${mb(MAX_MEDIA_BYTES)}. Bitte nehmen Sie ein kürzeres Video auf.`,
      );
    }

    const outputType = blob.type || "video/webm";
    const ext = outputType === "video/mp4" ? "mp4" : "webm";
    const base = file.name.replace(/\.[^.]+$/, "") || "fahrzeug";
    return new File([blob], `${base}-optimiert.${ext}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    stream?.getTracks().forEach((track) => track.stop());
    URL.revokeObjectURL(url);
  }
}

async function prepareMedia(file: File): Promise<File> {
  if (file.type.startsWith("image/")) {
    const needsConversion = !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > IMAGE_COMPRESSION_TRIGGER;
    const prepared = needsConversion ? await compressImage(file) : file;
    if (prepared.size > MAX_MEDIA_BYTES) {
      throw new Error(`Das Foto ist nach der Optimierung noch größer als ${mb(MAX_MEDIA_BYTES)}.`);
    }
    return prepared;
  }

  if (file.type.startsWith("video/")) {
    const directlySupported = ALLOWED_VIDEO_TYPES.has(file.type) && file.size <= MAX_MEDIA_BYTES;
    if (directlySupported) return file;
    return compressVideo(file);
  }

  throw new Error("Bitte wählen Sie ein Foto oder Video aus.");
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
  /** Im Buchungsassistenten bedeutet true auch: Pflichtmedium fehlt. */
  onUploadingChange?: (uploading: boolean) => void;
  inputId?: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [processingName, setProcessingName] = useState<string | null>(null);
  const upload = useServerFn(uploadConditionPhoto);

  const mediaRequired = inputId === "buchung-zustand-fotos";
  const requirementMissing = mediaRequired && photos.length === 0;

  useEffect(() => {
    onUploadingChange?.(uploading || requirementMissing);
  }, [onUploadingChange, requirementMissing, uploading]);

  // Die Pflicht- und Hilfetexte des Buchungsschritts werden hier synchron
  // gehalten, weil diese Komponente sowohl dort als auch auf der separaten
  // Zustandsseite verwendet wird.
  useEffect(() => {
    if (!mediaRequired) return;
    const anchor = document.getElementById(inputId);
    const section = anchor?.closest("section");
    if (!section) return;

    const heading = section.querySelector("h3");
    if (heading) heading.textContent = "Fahrzeugzustand";
    const headerText = heading?.parentElement?.querySelector("p");
    if (headerText) {
      headerText.textContent =
        "Bitte laden Sie mindestens ein aktuelles Foto oder Video Ihres Fahrzeugs hoch. So können wir Zustand und Aufwand vor der Terminbestätigung realistisch einschätzen.";
    }

    const noteLabel = section.querySelector('label[for="buchung-zustand-notiz"]');
    if (noteLabel) {
      noteLabel.textContent = "Unsicher, was gemacht werden soll? (optional)";
    }
    const note = section.querySelector<HTMLTextAreaElement>("#buchung-zustand-notiz");
    if (note) {
      note.placeholder =
        "Sie müssen keine Fachbegriffe kennen: Schreiben Sie einfach, was Sie am Fahrzeug stört oder welches Ergebnis Sie sich wünschen. Zum Beispiel: Lack wirkt stumpf, Innenraum riecht, Sitze haben Flecken oder ich weiß nicht, welches Paket sinnvoll ist.";
    }

    const paragraphs = Array.from(section.querySelectorAll(":scope > p"));
    const optionalHint = paragraphs.find((element) =>
      element.textContent?.includes("Dieser Schritt ist freiwillig"),
    );
    if (optionalHint) {
      optionalHint.textContent =
        "Mindestens eine aktuelle Aufnahme (Foto oder Video) ist erforderlich. Wenn Sie nicht wissen, welche Behandlung sinnvoll ist, beschreiben Sie einfach kurz Ihr Ziel – wir empfehlen Ihnen die passende Lösung.";
    }
  }, [inputId, mediaRequired]);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    const free = MAX_PHOTOS - photos.length;
    if (free <= 0) {
      toast.error(`Es sind höchstens ${MAX_PHOTOS} Medien möglich.`);
      input.value = "";
      return;
    }

    setUploading(true);
    const added: UploadedPhoto[] = [];

    for (const original of files.slice(0, free)) {
      try {
        setProcessingName(original.name);
        if (original.type.startsWith("video/") && original.size > MAX_MEDIA_BYTES) {
          toast.info("Das Video wird vor dem Upload automatisch verkleinert.");
        } else if (original.type.startsWith("image/") && original.size > IMAGE_COMPRESSION_TRIGGER) {
          toast.info("Das Foto wird vor dem Upload automatisch verkleinert.");
        }

        const file = await prepareMedia(original);
        if (file.size < original.size * 0.92) {
          toast.success(`${original.name}: ${mb(original.size)} → ${mb(file.size)}`);
        }

        const base64Data = await fileToBase64(file);
        const result = await upload({
          data: { fileName: file.name, contentType: file.type, base64Data },
        });
        added.push({
          path: result.path,
          previewUrl: URL.createObjectURL(file),
          name: file.name,
          kind: file.type.startsWith("video/") ? "video" : "image",
          sizeBytes: file.size,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : `„${original.name}“ konnte nicht geladen werden.`,
        );
      }
    }

    if (added.length > 0) onChange([...photos, ...added]);
    if (files.length > free) {
      toast.warning(`Nur die ersten ${free} Medien wurden übernommen.`);
    }
    setProcessingName(null);
    setUploading(false);
    input.value = "";
  }

  function removePhoto(path: string) {
    const removed = photos.find((photo) => photo.path === path);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(photos.filter((photo) => photo.path !== path));
  }

  const disabled = uploading || photos.length >= MAX_PHOTOS;
  const cameraInputId = `${inputId}-camera`;
  const videoInputId = `${inputId}-video`;
  const galleryInputId = `${inputId}-gallery`;

  return (
    <div className="space-y-4">
      {mediaRequired && (
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
            ? "Pflichtangabe: Bitte laden Sie mindestens ein aktuelles Foto oder Video des Fahrzeugs hoch."
            : "Fahrzeugzustand erfasst – Sie können weitere Aufnahmen ergänzen oder fortfahren."}
        </div>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.path} className="relative">
              <div className="aspect-square overflow-hidden rounded-xl border border-border/60 bg-secondary/30">
                {photo.kind === "video" ? (
                  <video
                    src={photo.previewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="size-full object-cover"
                    aria-label={`Videovorschau: ${photo.name}`}
                  />
                ) : (
                  <img
                    src={photo.previewUrl}
                    alt={`Vorschau: ${photo.name}`}
                    className="size-full object-cover"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => removePhoto(photo.path)}
                aria-label={`${photo.name} entfernen`}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {photo.kind === "video" ? "Video" : "Foto"} · {mb(photo.sizeBytes)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFiles}
        disabled={disabled}
        aria-label="Foto mit der Kamera aufnehmen"
        className="hidden"
        id={cameraInputId}
      />
      <input
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleFiles}
        disabled={disabled}
        aria-label="Video mit der Kamera aufnehmen"
        className="hidden"
        id={videoInputId}
      />
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFiles}
        disabled={disabled}
        aria-label="Fotos oder Videos aus der Galerie auswählen"
        className="hidden"
        id={galleryInputId}
      />

      <span id={inputId} className="sr-only" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          asChild
          type="button"
          variant={mediaRequired ? "default" : "outline"}
          disabled={disabled}
          className="gap-2"
        >
          <label htmlFor={cameraInputId} className="cursor-pointer">
            {uploading ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Camera aria-hidden className="size-4" />
            )}
            {uploading ? "Wird verarbeitet …" : "Foto aufnehmen"}
          </label>
        </Button>

        <Button asChild type="button" variant="outline" disabled={disabled} className="gap-2">
          <label htmlFor={videoInputId} className="cursor-pointer">
            <Video aria-hidden className="size-4" />
            Video aufnehmen
          </label>
        </Button>

        <Button asChild type="button" variant="outline" disabled={disabled} className="gap-2">
          <label htmlFor={galleryInputId} className="cursor-pointer">
            <Images aria-hidden className="size-4" />
            Aus Galerie wählen
          </label>
        </Button>

        <p className="text-xs text-muted-foreground">
          {photos.length} von {MAX_PHOTOS} Medien · Fotos werden automatisch optimiert · Videos bis
          90 Sek.
        </p>
      </div>

      {processingName && (
        <p className="text-xs text-primary" role="status" aria-live="polite">
          {processingName} wird vorbereitet und sicher hochgeladen …
        </p>
      )}

      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}
