import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Car,
  CheckCircle2,
  CircleDot,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { ConditionPhotoUpload, type UploadedPhoto } from "@/components/ConditionPhotoUpload";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import {
  DENT_REPAIR_PRICE_HEADING,
  DENT_REPAIR_PRICE_LABEL,
  DENT_REPAIR_PRICE_NOTICE,
  dentAssessmentModes,
  dentDamageTypes,
} from "@/lib/dentRepair";
import { submitDentRepairRequest } from "@/lib/dentRepair.functions";
import { absUrl, standardPageMeta } from "@/lib/seo";

const TITLE = "Dellenentfernung & Hagelschaden-Reparatur | White Gloss";
const DESCRIPTION =
  "Parkdellen, kleinere Karosseriedellen und Hagelschäden lackschadenfrei ausbeulen lassen. Begutachtung in Horb am Neckar oder bei kleinen Schäden per Foto anfragen.";

export const Route = createFileRoute("/dellen-hagelschaden")({
  head: () => ({
    meta: standardPageMeta({
      title: TITLE,
      description: DESCRIPTION,
      path: "/dellen-hagelschaden",
    }),
    links: [
      { rel: "canonical", href: absUrl("/dellen-hagelschaden") },
      { rel: "alternate", hrefLang: "de-DE", href: absUrl("/dellen-hagelschaden") },
      { rel: "alternate", hrefLang: "x-default", href: absUrl("/dellen-hagelschaden") },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Dellenentfernung & Hagelschaden-Reparatur",
          provider: { "@type": "AutoRepair", name: "White Gloss Detailing" },
          areaServed: "Horb am Neckar und Umgebung",
          description: DESCRIPTION,
          url: absUrl("/dellen-hagelschaden"),
        }),
      },
    ],
  }),
  component: DentRepairPage,
});

const fieldClass = "mt-2 h-12 bg-secondary/40";
const selectClass =
  "mt-2 h-12 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function DentRepairPage() {
  const navigate = useNavigate();
  const submitRequest = useServerFn(submitDentRepairRequest);
  const [damageType, setDamageType] = useState("");
  const [vehicleArea, setVehicleArea] = useState("");
  const [dentCount, setDentCount] = useState("");
  const [dentSize, setDentSize] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [assessmentMode, setAssessmentMode] = useState("Foto, wenn möglich");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (uploading || sending) return;
    setSending(true);
    try {
      const result = await submitRequest({
        data: {
          damageType,
          vehicleArea,
          dentCount,
          dentSize,
          vehicleMake,
          vehicleModel,
          photoPaths: photos.map((photo) => photo.path),
          name,
          email,
          phone,
          preferredDate,
          assessmentMode,
          note,
          consent,
        },
      });
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      toast.success("Begutachtungsanfrage gesendet.");
      await navigate({
        to: "/danke-dellen",
        search: { nr: result.reference, name: result.customerName.split(/\s+/)[0] || undefined },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Die Anfrage konnte nicht gesendet werden.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-border">
          <div className="grid-lines absolute inset-0 -z-10 opacity-20" aria-hidden />
          <div className="chrome-orb -right-32 -top-32 -z-10" aria-hidden />
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
            <Link
              to="/leistungen"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="size-4" /> Alle Leistungen
            </Link>
            <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <p className="eyebrow">Smart Repair · eigenständig anfragbar</p>
                <h1 className="display-page mt-3 max-w-5xl uppercase">
                  Dellenentfernung &{" "}
                  <span className="text-chrome block">Hagelschaden-Reparatur</span>
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Parkdellen, kleinere Karosseriedellen und Hagelschäden entfernen wir mit
                  lackschadenfreier Ausbeultechnik, sofern dies technisch möglich ist. Diese
                  Leistung können Sie unabhängig von allen Aufbereitungspaketen anfragen.
                </p>
              </div>
              <aside className="glass rounded-3xl border-primary/30 p-6 sm:p-8">
                <p className="eyebrow">{DENT_REPAIR_PRICE_HEADING}</p>
                <p className="display-sub mt-3 text-primary">{DENT_REPAIR_PRICE_LABEL}</p>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {DENT_REPAIR_PRICE_NOTICE}
                </p>
              </aside>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-surface/25">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [CircleDot, "Parkdellen", "Dellen durch Türen und enge Parkplätze"],
                [Car, "Karosseriedellen", "Kleinere Verformungen an zugänglichen Bauteilen"],
                [ShieldCheck, "Hagelschäden", "Einzelne oder zahlreiche Hageldellen"],
                [
                  Camera,
                  "Foto-Begutachtung",
                  "Bei kleinen Schäden häufig ohne ersten Vor-Ort-Termin",
                ],
              ].map(([Icon, title, text]) => {
                const ServiceIcon = Icon as typeof Car;
                return (
                  <article key={String(title)} className="feature-card rounded-2xl p-5">
                    <ServiceIcon className="size-6 text-primary" />
                    <h2 className="display-card mt-5 uppercase">{String(title)}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{String(text)}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="begutachtung" className="scroll-mt-28">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="text-center">
              <p className="eyebrow">Unverbindliche Anfrage</p>
              <h2 className="display-section mt-3 uppercase">Begutachtung anfragen</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                Je genauer Ihre Angaben und Fotos sind, desto besser können wir vorab einschätzen,
                ob eine Begutachtung per Foto ausreicht.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <fieldset className="glass rounded-3xl p-5 sm:p-8">
                <legend className="display-card px-2 uppercase">1 · Schaden</legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Art des Schadens" icon={CircleDot}>
                    <select
                      required
                      value={damageType}
                      onChange={(e) => setDamageType(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Bitte wählen …</option>
                      {dentDamageTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Betroffener Fahrzeugbereich" icon={MapPin}>
                    <Input
                      required
                      value={vehicleArea}
                      onChange={(e) => setVehicleArea(e.target.value)}
                      maxLength={160}
                      placeholder="z. B. Fahrertür, Dach, Kotflügel hinten rechts"
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Ungefähre Anzahl der Dellen" icon={CircleDot}>
                    <Input
                      required
                      value={dentCount}
                      onChange={(e) => setDentCount(e.target.value)}
                      maxLength={80}
                      placeholder="z. B. 1, 3–5 oder mehr als 20"
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Ungefähre Größe" icon={CircleDot}>
                    <Input
                      required
                      value={dentSize}
                      onChange={(e) => setDentSize(e.target.value)}
                      maxLength={120}
                      placeholder="z. B. erbsengroß, 2-Euro-Münze, handtellergroß"
                      className={fieldClass}
                    />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="glass rounded-3xl p-5 sm:p-8">
                <legend className="display-card px-2 uppercase">2 · Fahrzeug & Fotos</legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Fahrzeugmarke" icon={Car}>
                    <Input
                      required
                      value={vehicleMake}
                      onChange={(e) => setVehicleMake(e.target.value)}
                      maxLength={80}
                      placeholder="z. B. BMW"
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Modell" icon={Car}>
                    <Input
                      required
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      maxLength={120}
                      placeholder="z. B. 3er Touring"
                      className={fieldClass}
                    />
                  </Field>
                </div>
                <div className="mt-7 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
                  <p className="font-semibold">Mehrere Fotos des Schadens hochladen</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Ideal sind eine Gesamtansicht, eine schräge Aufnahme im Licht und Nahaufnahmen.
                    Fotos sind freiwillig, ermöglichen bei kleinen Schäden aber oft eine
                    Begutachtung aus der Ferne.
                  </p>
                  <div className="mt-5">
                    <ConditionPhotoUpload
                      photos={photos}
                      onChange={setPhotos}
                      onUploadingChange={setUploading}
                      inputId="dellen-fotos"
                      hint="Die Aufnahmen werden privat gespeichert und sind nicht öffentlich sichtbar."
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="glass rounded-3xl p-5 sm:p-8">
                <legend className="display-card px-2 uppercase">3 · Kontakt & Wunschtermin</legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Name" icon={User}>
                    <Input
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={120}
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="E-Mail" icon={Mail}>
                    <Input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={254}
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Telefon" icon={Phone}>
                    <Input
                      required
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={40}
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Gewünschter Termin zur Begutachtung" icon={CalendarDays}>
                    <Input
                      required
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Bevorzugte Begutachtung" icon={Camera}>
                    <select
                      required
                      value={assessmentMode}
                      onChange={(e) => setAssessmentMode(e.target.value)}
                      className={selectClass}
                    >
                      {dentAssessmentModes.map((mode) => (
                        <option key={mode}>{mode}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Zusätzliche Hinweise (optional)" icon={CircleDot}>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="z. B. Lack ist unbeschädigt, Delle entstand gestern …"
                      className="mt-2 bg-secondary/40"
                    />
                  </Field>
                </div>

                <div className="mt-7 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                  <p className="font-semibold text-primary">{DENT_REPAIR_PRICE_LABEL}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Der gewählte Termin dient zunächst der Schadenbegutachtung und individuellen
                    Preisermittlung. Eine Reparatur beginnt erst, nachdem Sie dem vereinbarten Preis
                    und der Ausführung ausdrücklich zugestimmt haben.
                  </p>
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm leading-6 text-muted-foreground">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 size-4 accent-[var(--primary)]"
                  />
                  <span>
                    Ich bin damit einverstanden, dass meine Angaben und hochgeladenen Aufnahmen zur
                    Bearbeitung der Begutachtungsanfrage gespeichert und verarbeitet werden.
                  </span>
                </label>
              </fieldset>

              <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/95 px-4 py-4 shadow-[0_-16px_32px_-24px_rgba(0,0,0,.9)] backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                <Button
                  type="submit"
                  size="lg"
                  loading={sending}
                  disabled={uploading || sending}
                  className="w-full rounded-xl sm:w-auto sm:min-w-64"
                >
                  {sending ? "Wird gesendet …" : "Begutachtung anfragen"}
                  {!sending && <CheckCircle2 className="size-4" />}
                </Button>
              </div>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
      <Toaster position="top-center" richColors />
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Car;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {label}
      </span>
      {children}
    </label>
  );
}
