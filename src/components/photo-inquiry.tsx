import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { site } from "@/data/site";
import { createPublicPhotoInquiry } from "@/lib/bookings.functions";
import { Button, Field, inputLine } from "./ui";

export function PhotoInquiry({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Bitte Name und Telefon angeben.");
      return;
    }
    if (!privacy) {
      setError("Bitte die Datenschutzerklärung bestätigen.");
      return;
    }
    if (!text.trim() && files.length === 0) {
      setError("Bitte mindestens eine Aufnahme oder eine kurze Beschreibung angeben.");
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
      setError("Senden fehlgeschlagen. Bitte erreichen Sie uns telefonisch oder per WhatsApp.");
      setPending(false);
    }
  }

  if (sent) {
    return (
      <p className="rounded-card border border-line bg-elevated p-5 text-sm text-muted">
        Anfrage im Posteingang. Wir melden uns unter der angegebenen Nummer. {site.phoneDisplay}
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      data-hide-whatsapp
      aria-label={title}
      className="relative space-y-5 rounded-card border border-line bg-surface p-5"
    >
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="text-sm text-muted">{hint}</p>
      <p className="text-xs text-subtle">
        Es findet kein Datei-Upload statt. Die Aufnahmen bleiben auf diesem Gerät. Übermittelt
        werden Name, Telefon, Beschreibung und Dateinamen zur Zuordnung. Für die Begutachtung
        fordern wir Fotos bei Bedarf über einen separaten sicheren Kanal an.
      </p>
      <Field tone="public" id="media" label="Fotos oder kurzes Video (max. 8, Dateinamen zur Zuordnung)">
        <input
          id="media"
          type="file"
          accept="image/*,video/*"
          multiple
          className="text-sm"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))}
        />
        {files.length ? (
          <p className="text-xs text-subtle">{files.length} Datei(en) gewählt</p>
        ) : null}
      </Field>
      <Field tone="public" id="desc" label="Beschreibung">
        <textarea
          id="desc"
          maxLength={2000}
          className={`${inputLine} min-h-28 py-2`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <Field tone="public" id="iname" label="Name">
        <input
          id="iname"
          className={inputLine}
          autoComplete="name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field tone="public" id="iphone" label="Telefon">
        <input
          id="iphone"
          className={inputLine}
          autoComplete="tel"
          inputMode="tel"
          type="tel"
          name="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
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
          type="checkbox"
          className="mt-1"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          required
        />
        Name, Telefon, Beschreibung und Dateinamen werden zur Bearbeitung übermittelt. Siehe{" "}
        <Link to="/datenschutz" className="underline hover:text-fg">
          Datenschutzerklärung
        </Link>
        . Die Dateien selbst werden nicht hochgeladen und bleiben auf diesem Gerät.
      </label>
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
