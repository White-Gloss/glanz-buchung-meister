import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ConditionPhotoUpload, type UploadedPhoto } from "@/components/ConditionPhotoUpload";
import { submitConditionReport } from "@/lib/conditionReports.functions";
import { absUrl, OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";

/**
 * ZUSTAND MELDEN
 * ---------------
 * Ergänzt den Buchungsbereich: Wer vorab wissen möchte, was bei seinem
 * Fahrzeug sinnvoll ist, schickt Fotos und eine Beschreibung. Das spart
 * beiden Seiten die Rückfragen, die sonst am Telefon nötig wären.
 *
 * Die Fotos landen in einem privaten Speicher und sind ausschließlich im
 * Admin-Bereich sichtbar — nicht öffentlich abrufbar.
 */

const META_TITLE = "Fahrzeugzustand prüfen lassen | White Gloss Detailing";
// Unter 155 Zeichen: darüber kürzt Google deutsche Snippets sichtbar ab.
const META_DESCRIPTION =
  "Fotos vom Fahrzeug hochladen, Zustand beschreiben und eine ehrliche Einschätzung erhalten — kostenlos und unverbindlich aus Horb am Neckar.";
const CANONICAL = absUrl("/fahrzeug-zustand");

export const Route = createFileRoute("/fahrzeug-zustand")({
  head: () => ({
    meta: [
      { title: META_TITLE },
      { name: "description", content: META_DESCRIPTION },
      { property: "og:title", content: META_TITLE },
      { property: "og:description", content: META_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: META_TITLE },
      { name: "twitter:description", content: META_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: CANONICAL },
      { rel: "alternate", hrefLang: "de-DE", href: CANONICAL },
    ],
  }),
  component: ConditionPage,
});

function ConditionPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [conditionText, setConditionText] = useState("");
  const [consent, setConsent] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  // Solange Fotos unterwegs sind, bleibt „Anfrage senden“ gesperrt.
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = useServerFn(submitConditionReport);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!consent) {
      toast.error("Bitte bestätigen Sie die Einwilligung zur Verarbeitung.");
      return;
    }
    setSending(true);
    try {
      await submit({
        data: {
          name,
          email,
          phone,
          vehicle,
          plate,
          conditionText,
          photoPaths: photos.map((photo) => photo.path),
        },
      });
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Das Senden ist fehlgeschlagen.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
            <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">
                Startseite
              </Link>
              <span className="px-2">/</span>
              <span className="text-foreground">Zustand prüfen lassen</span>
            </nav>

            {/* Greift die Bezeichnung aus dem Hauptmenü auf, damit klar ist,
                dass dies die Seite hinter „Individuelles Angebot“ ist. */}
            <p className="eyebrow mt-7">Individuelles Angebot</p>
            <h1 className="text-gradient display-page mt-3">Zustand prüfen lassen</h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Schicken Sie uns ein paar Fotos und eine kurze Beschreibung. Wir sehen uns das an und
              sagen Ihnen ehrlich, was bei Ihrem Fahrzeug sinnvoll ist — und was nicht. Kostenlos
              und unverbindlich.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          {done ? <SuccessPanel /> : null}

          {!done && (
            <>
              <div className="glass mb-8 rounded-2xl p-5 text-sm leading-6 text-muted-foreground">
                <p className="font-medium text-foreground">Welche Fotos helfen uns am meisten?</p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>Das ganze Fahrzeug von schräg vorn und schräg hinten</li>
                  <li>
                    Nahaufnahmen von Stellen, die Sie stören — Kratzer, matte Partien, Flecken
                  </li>
                  <li>Innenraum: Sitze, Fußräume, Armaturenbrett</li>
                  <li>Am besten bei Tageslicht und trockenem Lack</li>
                </ul>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <fieldset className="glass space-y-4 rounded-2xl p-5">
                  <legend className="display-card px-1 text-sm uppercase">Ihre Fotos</legend>
                  <ConditionPhotoUpload
                    photos={photos}
                    onChange={setPhotos}
                    onUploadingChange={setUploading}
                  />
                </fieldset>

                <fieldset className="glass space-y-4 rounded-2xl p-5">
                  <legend className="display-card px-1 text-sm uppercase">Zustand</legend>
                  {/*
                    Beschriftungen sind bewusst über htmlFor/id verknüpft statt
                    das Feld einzuschachteln: Sonst würde der Hinweistext
                    darunter Teil des vorgelesenen Feldnamens. Der Hinweis
                    hängt stattdessen über aria-describedby daran.
                  */}
                  <div className="block">
                    <label
                      htmlFor="zustand-beschreibung"
                      className="text-xs uppercase tracking-widest text-muted-foreground"
                    >
                      Was sollen wir uns ansehen?
                    </label>
                    <Textarea
                      id="zustand-beschreibung"
                      aria-describedby="zustand-beschreibung-hinweis"
                      value={conditionText}
                      onChange={(event) => setConditionText(event.target.value)}
                      rows={7}
                      required
                      maxLength={4000}
                      placeholder="Zum Beispiel: Der Lack ist matt und hat viele feine Kratzer von der Waschanlage. Auf der Motorhaube sind Flecken, die sich nicht abwaschen lassen. Innen sind die Sitze verschmutzt, im Kofferraum riecht es muffig."
                      className="mt-1.5 bg-secondary/40"
                    />
                    <span
                      id="zustand-beschreibung-hinweis"
                      className="mt-1 block text-xs text-muted-foreground"
                    >
                      {conditionText.length}/4000 Zeichen — je genauer, desto belastbarer unsere
                      Einschätzung.
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="block">
                      <label
                        htmlFor="zustand-fahrzeug"
                        className="text-xs uppercase tracking-widest text-muted-foreground"
                      >
                        Fahrzeug
                      </label>
                      <Input
                        id="zustand-fahrzeug"
                        value={vehicle}
                        onChange={(event) => setVehicle(event.target.value)}
                        placeholder="z. B. VW Golf 8, Baujahr 2021"
                        maxLength={120}
                        className="mt-1.5 bg-secondary/40"
                      />
                    </div>
                    <div className="block">
                      <label
                        htmlFor="zustand-kennzeichen"
                        className="text-xs uppercase tracking-widest text-muted-foreground"
                      >
                        Kennzeichen (freiwillig)
                      </label>
                      <Input
                        id="zustand-kennzeichen"
                        value={plate}
                        onChange={(event) => setPlate(event.target.value)}
                        placeholder="nur wenn Sie möchten"
                        maxLength={20}
                        className="mt-1.5 bg-secondary/40"
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="glass space-y-4 rounded-2xl p-5">
                  <legend className="display-card px-1 text-sm uppercase">Kontakt</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="block">
                      <label
                        htmlFor="zustand-name"
                        className="text-xs uppercase tracking-widest text-muted-foreground"
                      >
                        Name
                      </label>
                      <Input
                        id="zustand-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                        maxLength={120}
                        autoComplete="name"
                        className="mt-1.5 bg-secondary/40"
                      />
                    </div>
                    <div className="block">
                      <label
                        htmlFor="zustand-email"
                        className="text-xs uppercase tracking-widest text-muted-foreground"
                      >
                        E-Mail
                      </label>
                      <Input
                        id="zustand-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        maxLength={254}
                        autoComplete="email"
                        className="mt-1.5 bg-secondary/40"
                      />
                    </div>
                  </div>
                  <div className="block">
                    <label
                      htmlFor="zustand-telefon"
                      className="text-xs uppercase tracking-widest text-muted-foreground"
                    >
                      Telefon (freiwillig)
                    </label>
                    <Input
                      id="zustand-telefon"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      maxLength={40}
                      autoComplete="tel"
                      className="mt-1.5 bg-secondary/40"
                    />
                  </div>
                </fieldset>

                {/*
                  Der Verweis auf die Datenschutzerklärung steht bewusst
                  AUSSERHALB des Labels: Läge er darin, würde ein Klick
                  darauf gleichzeitig die Zustimmung umschalten und
                  wegnavigieren. Verbunden ist er über aria-describedby.
                */}
                <div className="glass rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <input
                      id="zustand-einwilligung"
                      aria-describedby="zustand-einwilligung-hinweis"
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                      required
                      className="mt-1 size-4 shrink-0 cursor-pointer rounded border-input accent-primary"
                    />
                    <div>
                      <label
                        htmlFor="zustand-einwilligung"
                        className="cursor-pointer text-sm leading-6 text-muted-foreground"
                      >
                        Ich bin damit einverstanden, dass meine Angaben und Fotos zur Bearbeitung
                        meiner Anfrage gespeichert und verarbeitet werden. Die Fotos sind nicht
                        öffentlich abrufbar.
                      </label>
                      <p
                        id="zustand-einwilligung-hinweis"
                        className="mt-1 text-sm leading-6 text-muted-foreground"
                      >
                        Weitere Hinweise in der{" "}
                        <Link
                          to="/datenschutz"
                          className="text-primary underline underline-offset-2"
                        >
                          Datenschutzerklärung
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" size="lg" loading={sending} disabled={uploading}>
                    Anfrage senden
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Wir melden uns in der Regel innerhalb eines Werktags.
                  </p>
                </div>
              </form>
            </>
          )}
        </section>
      </main>
      <SiteFooter />
      {/*
        Ohne diesen Toaster blieben Fehlermeldungen unsichtbar: Der
        Admin-Bereich bekommt ihn über die _authenticated-Layoutroute,
        öffentliche Seiten aber nicht. Hier zählt das besonders, weil ein
        fehlgeschlagener Upload sonst kommentarlos verpufft.
      */}
      <Toaster position="top-center" richColors />
    </div>
  );
}

function SuccessPanel() {
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <CheckCircle2 aria-hidden className="mx-auto size-10 text-primary" />
      <h2 className="display-sub mt-4">Angekommen — vielen Dank.</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
        Wir sehen uns Ihre Fotos an und melden uns in der Regel innerhalb eines Werktags mit einer
        Einschätzung bei Ihnen. Wenn es schneller gehen soll, rufen Sie uns gern direkt an.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <Link to="/">Zur Startseite</Link>
        </Button>
        <Button asChild>
          <Link to="/" hash="buchung">
            <Camera aria-hidden className="size-4" />
            Termin konfigurieren
          </Link>
        </Button>
      </div>
    </div>
  );
}
