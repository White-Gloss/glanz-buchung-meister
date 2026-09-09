import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { createPublicPhotoInquiry } from "@/lib/bookings.functions";
import { photoInquiryErrors } from "@/lib/public-form-validation";
import { usePublicFormErrors } from "./public-form-feedback";
import { SubmissionResult } from "./submission-result";
import { Button, Field, inputLine } from "./ui";

export function PhotoInquiry({ title, hint }: { title: string; hint: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const { fieldProps, fieldError, showErrors } = usePublicFormErrors();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const errors = photoInquiryErrors({ name, phone, privacy, text, files });
    showErrors(errors, e.currentTarget);
    if (Object.keys(errors).length) {
      setError("Bitte prüfen Sie die markierten Felder.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await createPublicPhotoInquiry({
        data: {
          title,
          name: name.trim(),
          phone: phone.trim(),
          text,
          files: files.map((f) => f.name),
          privacy: true as const,
          website,
        },
      });
      setSent(true);
    } catch {
      setError("Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns telefonisch oder per WhatsApp.");
      setPending(false);
    }
  }

  if (sent) {
    return (
      <SubmissionResult className="rounded-card border border-line bg-elevated p-5 text-sm text-muted">
        Vielen Dank für Ihre Anfrage. Wir melden uns unter der angegebenen Telefonnummer.
      </SubmissionResult>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      data-hide-whatsapp
      aria-label={title}
      className="relative space-y-5 rounded-card border border-line bg-surface p-5"
    >
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="text-sm text-muted">{hint}</p>
      <p className="text-xs text-subtle">
        Dieses Formular übermittelt Ihre Kontaktdaten, Ihre Beschreibung und die Namen
        ausgewählter Dateien. Die Fotos und Videos selbst bleiben auf Ihrem Gerät.
        Benötigen wir die Aufnahmen zur Begutachtung, stimmen wir eine sichere Übermittlung mit Ihnen ab.
      </p>
      <Field
        tone="public"
        id="media"
        label="Aufnahmen auswählen (optional, max. 8 Dateien; nur Dateinamen werden übermittelt)"
      >
        <input
          id="media"
          {...fieldProps("media")}
          type="file"
          accept="image/*,video/*"
          multiple
          className="w-full min-w-0 max-w-full text-sm"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))}
        />
        {fieldError("media")}
        {files.length ? (
          <p className="text-xs text-subtle">{files.length} {files.length === 1 ? "Datei ausgewählt" : "Dateien ausgewählt"}</p>
        ) : null}
      </Field>
      <Field tone="public" id="desc" label="Beschreibung">
        <textarea
          id="desc"
          {...fieldProps("text")}
          maxLength={2000}
          className={`${inputLine} min-h-28 py-2`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {fieldError("text")}
      </Field>
      <Field tone="public" id="iname" label="Name">
        <input
          id="iname"
          className={inputLine}
          autoComplete="name"
          name="name"
          minLength={2}
          maxLength={120}
          {...fieldProps("name")}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {fieldError("name")}
      </Field>
      <Field tone="public" id="iphone" label="Telefon">
        <input
          id="iphone"
          className={inputLine}
          autoComplete="tel"
          inputMode="tel"
          type="tel"
          name="tel"
          minLength={6}
          maxLength={40}
          {...fieldProps("phone")}
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {fieldError("phone")}
      </Field>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="iwebsite">Website</label>
        <input
          id="iwebsite"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <label htmlFor="iprivacy" className="flex items-start gap-2 text-sm text-muted">
        <input
          id="iprivacy"
          {...fieldProps("privacy")}
          type="checkbox"
          className="mt-1"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          required
        />
        <span className="min-w-0">
          Name, Telefon, Beschreibung und Dateinamen werden zur Bearbeitung übermittelt. Siehe{" "}
          <Link to="/datenschutz" className="underline hover:text-fg">
            Datenschutzerklärung
          </Link>
          . Die Dateien selbst werden nicht hochgeladen und bleiben auf diesem Gerät.
        </span>
      </label>
      {fieldError("privacy")}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button tone="public" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Wird gesendet …" : "Anfrage senden"}
      </Button>
    </form>
  );
}
