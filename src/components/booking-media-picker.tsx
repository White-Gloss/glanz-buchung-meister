import { useEffect, useState } from "react";
import { UPLOAD_MIME_TYPES, uploadSelectionError } from "@/lib/upload-policy";
import { inputLine } from "./ui";

function Preview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return file.type.startsWith("video/") ? (
    <video src={url} controls className="h-24 w-32 rounded-md object-cover" />
  ) : (
    <img src={url} alt={file.name} className="h-24 w-32 rounded-md object-cover" />
  );
}

export function BookingMediaPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState("");
  function update(next: File[]) {
    const problem = next.length ? uploadSelectionError(next) : "";
    setError(problem);
    if (!problem) onChange(next);
  }
  return (
    <section
      className="mt-5 space-y-3 rounded-card border border-line p-4"
      aria-label="Optionale Fahrzeugfotos"
    >
      <h3 className="font-medium">Fahrzeugfotos (optional)</h3>
      <p className="text-xs text-muted">
        Bis zu acht Aufnahmen, je 12 MB. JPEG, PNG, WebP, MP4, MOV oder WebM. Die Anfrage ist auch
        ohne Fotos möglich.
      </p>
      <label className="block text-sm">
        Aufnahmen auswählen
        <input
          type="file"
          multiple
          accept={UPLOAD_MIME_TYPES.join(",")}
          disabled={disabled}
          className={inputLine}
          onChange={(e) => {
            update([...files, ...Array.from(e.target.files || [])]);
            e.target.value = "";
          }}
        />
      </label>
      {files.map((file, index) => (
        <div
          key={`${index}-${file.name}-${file.lastModified}`}
          className="flex flex-wrap gap-3 border-t border-line pt-3"
        >
          <Preview file={file} />
          <div className="min-w-0 flex-1 text-xs">
            <p className="break-words">{file.name}</p>
            <button
              type="button"
              disabled={disabled}
              className="mr-4 min-h-11 underline"
              onClick={() => update(files.filter((_, i) => i !== index))}
            >
              Entfernen
            </button>
            <label className="inline-block underline">
              Ersetzen
              <input
                aria-label={`Aufnahme ${index + 1} ersetzen`}
                type="file"
                accept={UPLOAD_MIME_TYPES.join(",")}
                disabled={disabled}
                className="block w-full"
                onChange={(e) => {
                  const replacement = e.target.files?.[0];
                  if (replacement) update(files.map((old, i) => (i === index ? replacement : old)));
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function mediaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Aufnahme konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}
