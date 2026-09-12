import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  cities,
  depositConfig,
  extras,
  packages,
  pickupPriceText,
  quoteTotal,
  site,
  timeSlots,
  vehicleClasses,
  type PackageId,
  type VehicleClass,
} from "@/data/site";
import { attachBookingPhotos, createPublicBooking } from "@/lib/bookings.functions";
import { eur } from "@/lib/utils";
import { bookingFormErrors } from "@/lib/public-form-validation";
import { queueBookingConversion } from "@/lib/googleTag";
import { bookingRequestId } from "@/lib/booking-request-id";
import { usePublicFormErrors } from "./public-form-feedback";
import { BookingMediaPicker, mediaBase64 } from "./booking-media-picker";
import { Button, Field, inputLine } from "./ui";

export function Configurator({ initialPackage = "premium" }: { initialPackage?: PackageId }) {
  const navigate = useNavigate();
  const [packageId, setPackageId] = useState<PackageId>(initialPackage);
  useEffect(() => {
    setPackageId(initialPackage);
  }, [initialPackage]);
  const [classId, setClassId] = useState<VehicleClass["id"]>("kompakt");
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [citySlug, setCitySlug] = useState("horb-am-neckar");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [note, setNote] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [busyDays, setBusyDays] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [media, setMedia] = useState<File[]>([]);
  const [savedReference, setSavedReference] = useState<string | null>(null);
  const saved = useRef<{ reference: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const { fieldProps, fieldError, showErrors } = usePublicFormErrors();

  useEffect(() => {
    const from = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    const until = new Date();
    until.setDate(until.getDate() + 60);
    const to = until.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    void fetch(`/api/availability?from=${from}&to=${to}`)
      .then((response) => response.json())
      .then((payload: { windows?: { start: string; end: string }[] }) => {
        const days = new Set<string>();
        for (const window of payload.windows || []) {
          const start = new Date(window.start);
          const end = new Date(window.end);
          for (let time = start.getTime(); time < end.getTime(); time += 12 * 60 * 60 * 1000) {
            days.add(new Date(time).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }));
          }
        }
        setBusyDays([...days]);
      })
      .catch(() => undefined);
  }, []);

  const quote = useMemo(
    () => quoteTotal({ packageId, classId, extraIds, citySlug }),
    [packageId, classId, extraIds, citySlug],
  );

  function toggleExtra(id: string) {
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    setError("");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    const errors = saved.current
      ? {}
      : bookingFormErrors({ name, phone, email, date, note, privacy }, today);
    if (
      !saved.current &&
      e.currentTarget.querySelector<HTMLInputElement>("#date")?.validity.badInput
    ) {
      errors.date = "Bitte geben Sie ein vollständiges Datum an oder lassen Sie das Feld leer.";
    }
    showErrors(errors, e.currentTarget);
    if (Object.keys(errors).length) {
      setError("Bitte prüfen Sie die markierten Felder.");
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      const created =
        saved.current ??
        (await createPublicBooking({
          data: {
            idempotencyKey: bookingRequestId.get(),
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            date,
            slot,
            note,
            packageId,
            classId,
            extraIds,
            citySlug,
            vehicleMake: vehicleMake.trim() || undefined,
            vehicleModel: vehicleModel.trim() || undefined,
            vehiclePlate: vehiclePlate.trim() || undefined,
            kind: "booking",
            privacy: true as const,
            website,
          },
        }));
      saved.current = created;
      setSavedReference(created.reference);
      queueBookingConversion(created.reference);
      const remaining = [...media];
      for (const [index, file] of media.entries()) {
        setUploadProgress(`Aufnahme ${index + 1} von ${media.length} wird übertragen …`);
        await attachBookingPhotos({
          data: {
            vorgang: created.reference,
            files: [
              { name: file.name.slice(0, 180), mime: file.type, base64: await mediaBase64(file) },
            ],
          },
        });
        remaining.shift();
        setMedia([...remaining]);
      }
      setUploadProgress("");
      await navigate({
        to: "/danke",
        search: {
          vorgang: created.reference,
        },
      });
      bookingRequestId.clear();
    } catch {
      setError(
        saved.current
          ? `Ihre Anfrage ${saved.current.reference} ist gespeichert. Die übrigen Fotos konnten nicht übertragen werden. Bitte erneut versuchen oder die Fotoauswahl entfernen, um ohne weitere Fotos fortzufahren.`
          : "Wir konnten den Eingang Ihrer Anfrage nicht bestätigen. Sie können dieselbe Anfrage erneut senden oder uns telefonisch bzw. per WhatsApp kontaktieren.",
      );
      setUploadProgress("");
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      data-hide-whatsapp
      aria-labelledby="buchung-heading"
      aria-label="Unverbindliche Terminanfrage"
      className="gd-form"
    >
      <div className="ga-fields space-y-8">
        <fieldset>
          <legend className="text-xs uppercase tracking-[0.16em] text-subtle">Paket</legend>
          <div className="mt-3 flex flex-col gap-3">
            {packages.map((p) => (
              <label
                key={p.id}
                className={`lift flex cursor-pointer items-start gap-3 rounded-card border p-4 ${
                  packageId === p.id ? "border-accent bg-elevated" : "border-line bg-surface"
                }`}
              >
                <input
                  disabled={pending || savedReference !== null}
                  type="radio"
                  name="paket"
                  value={p.id}
                  className="mt-1"
                  checked={packageId === p.id}
                  onChange={() => setPackageId(p.id)}
                />
                <span>
                  <span className="block text-sm font-medium text-fg">{p.name}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-subtle">
                    {p.searchLabel}
                  </span>
                  <span className="block text-sm text-muted">
                    ab {eur(p.price)} · {p.duration}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-subtle">{p.kicker}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs uppercase tracking-[0.16em] text-subtle">
            Fahrzeugklasse
          </legend>
          <div className="gd-tiles gd-tiles-3 mt-3">
            {vehicleClasses.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 ${
                  classId === c.id ? "border-accent bg-elevated" : "border-line bg-surface"
                }`}
              >
                <input
                  disabled={pending || savedReference !== null}
                  type="radio"
                  name="klasse"
                  value={c.id}
                  className="mt-1"
                  checked={classId === c.id}
                  onChange={() => setClassId(c.id)}
                />
                <span>
                  <span className="block text-sm font-medium text-fg">{c.label}</span>
                  <span className="mt-1 block text-xs text-muted">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs uppercase tracking-[0.16em] text-subtle">
            Zusatzleistungen
          </legend>
          {(["pflege", "reparatur"] as const).map((group) => (
            <div key={group} className="mt-4">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-subtle">
                {group === "pflege" ? "Pflege" : "Reparatur"}
              </p>
              <div className="mt-2 grid gap-2">
                {extras
                  .filter((ex) => ex.group === group)
                  .map((ex) => (
                    <label
                      key={ex.id}
                      className="flex items-start justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3"
                    >
                      <span className="flex min-w-0 items-start">
                        <input
                          disabled={pending || savedReference !== null}
                          id={`extra-${ex.id}`}
                          type="checkbox"
                          className="mt-1 mr-3"
                          checked={extraIds.includes(ex.id)}
                          onChange={() => toggleExtra(ex.id)}
                        />
                        <span>
                          <span className="block text-sm text-fg">{ex.name}</span>
                          <span className="mt-0.5 block text-xs text-subtle">
                            {ex.hint}
                            {ex.inspect ? " · nach Prüfung" : ""}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 pt-0.5 text-sm tabular-nums text-muted">
                        ab {eur(ex.price)}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </fieldset>

        <Field tone="public" id="city" label="Abholort">
          <select
            disabled={pending || savedReference !== null}
            id="city"
            className={inputLine}
            value={citySlug}
            onChange={(e) => setCitySlug(e.target.value)}
          >
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} · {c.km} km
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="ga-quote h-fit space-y-5 rounded-card border border-line bg-elevated p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Unverbindliche Anfrage</p>
        <p className="font-display text-3xl text-fg" aria-live="polite">
          {eur(quote.total)}
        </p>
        <p className="text-sm text-muted">
          {quote.klass.label} · {quote.pack.name}
          {quote.pickup === 0
            ? " · Abholung kostenlos"
            : quote.pickupOnRequest
              ? " · Abholung auf Anfrage"
              : quote.pickup
                ? ` · Abholung ${eur(quote.pickup)}`
                : ""}
        </p>
        <p className="text-xs text-subtle">
          Dies ist der voraussichtliche Preis inkl. MwSt. Falls der Fahrzeugzustand zusätzlichen
          Aufwand erfordert, stimmen wir den Endpreis nach der Begutachtung mit Ihnen ab.{" "}
          {depositConfig.label}: {depositConfig.note}
        </p>
        <Field tone="public" id="name" label="Name">
          <input
            disabled={pending || savedReference !== null}
            id="name"
            className={inputLine}
            autoComplete="name"
            name="name"
            minLength={2}
            maxLength={120}
            {...fieldProps("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {fieldError("name")}
        </Field>
        <Field tone="public" id="phone" label="Telefon">
          <input
            disabled={pending || savedReference !== null}
            id="phone"
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
        <Field tone="public" id="email" label="E-Mail (optional)">
          <input
            disabled={pending || savedReference !== null}
            id="email"
            type="email"
            className={inputLine}
            autoComplete="email"
            name="email"
            maxLength={160}
            {...fieldProps("email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldError("email")}
        </Field>
        <Field tone="public" id="vehicleMake" label="Fahrzeugmarke (optional)">
          <input
            disabled={pending || savedReference !== null}
            id="vehicleMake"
            className={inputLine}
            maxLength={80}
            value={vehicleMake}
            onChange={(e) => setVehicleMake(e.target.value)}
          />
        </Field>
        <Field tone="public" id="vehicleModel" label="Fahrzeugmodell (optional)">
          <input
            disabled={pending || savedReference !== null}
            id="vehicleModel"
            className={inputLine}
            maxLength={80}
            value={vehicleModel}
            onChange={(e) => setVehicleModel(e.target.value)}
          />
        </Field>
        <Field tone="public" id="vehiclePlate" label="Kennzeichen (optional)">
          <input
            disabled={pending || savedReference !== null}
            id="vehiclePlate"
            className={inputLine}
            maxLength={20}
            autoComplete="off"
            value={vehiclePlate}
            onChange={(e) => setVehiclePlate(e.target.value)}
          />
        </Field>
        <Field tone="public" id="date" label="Wunschtermin (optional)">
          <input
            disabled={pending || savedReference !== null}
            id="date"
            type="date"
            {...fieldProps("date")}
            className={inputLine}
            min={new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" })}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {fieldError("date")}
          {date && busyDays.includes(date) ? (
            <p className="text-xs text-muted">
              Dieser Tag ist in der Werkstatt bereits belegt. Die Anfrage bleibt unverbindlich; wir
              schlagen nach der Prüfung einen freien Zeitraum vor.
            </p>
          ) : null}
        </Field>
        <Field tone="public" id="slot" label="Gewünschte Abgabezeit (optional)">
          <select
            disabled={pending || savedReference !== null}
            id="slot"
            className={inputLine}
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
          >
            <option value="">Keine Angabe</option>
            {timeSlots.map((s) => (
              <option key={s} value={s}>
                {s} Uhr
              </option>
            ))}
          </select>
        </Field>
        <Field tone="public" id="note" label="Ihre Nachricht (optional)">
          <textarea
            disabled={pending || savedReference !== null}
            id="note"
            maxLength={2000}
            {...fieldProps("note")}
            className={`${inputLine} min-h-24 py-2`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {fieldError("note")}
        </Field>
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            disabled={pending || savedReference !== null}
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <BookingMediaPicker files={media} onChange={setMedia} disabled={pending} />
        {uploadProgress ? (
          <p role="status" className="text-sm">
            {uploadProgress}
          </p>
        ) : null}
        {savedReference ? (
          <p role="status" className="text-sm">
            Anfrage {savedReference} gespeichert. Noch keine Terminzusage.
          </p>
        ) : null}
        <label htmlFor="privacy" className="flex items-start gap-2 text-sm text-muted">
          <input
            disabled={pending || savedReference !== null}
            id="privacy"
            {...fieldProps("privacy")}
            type="checkbox"
            className="mt-1"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            required
          />
          <span>
            Ich habe die{" "}
            <Link to="/datenschutz" className="underline hover:text-fg">
              Datenschutzerklärung
            </Link>{" "}
            zur Kenntnis genommen. Die Anfrage ist unverbindlich.{" "}
            <Link to="/agb" className="underline hover:text-fg">
              AGB
            </Link>{" "}
            und{" "}
            <Link to="/widerruf" className="underline hover:text-fg">
              Widerruf
            </Link>
            .
          </span>
        </label>
        {fieldError("privacy")}
        {error ? (
          <div className="space-y-2">
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
            <Button
              tone="public"
              variant="line"
              type="button"
              disabled={pending}
              onClick={() => {
                saved.current = null;
                setSavedReference(null);
                bookingRequestId.clear();
                setError("");
              }}
            >
              Neue Anfrage beginnen
            </Button>
          </div>
        ) : null}
        <Button
          tone="public"
          type="submit"
          className="w-full"
          disabled={pending}
          aria-busy={pending}
        >
          {pending
            ? "Wird gesendet …"
            : savedReference
              ? media.length
                ? "Übrige Fotos erneut senden"
                : "Weiter zur Bestätigung"
              : "Terminanfrage senden"}
        </Button>
        <a
          href={site.whatsapp}
          className="block text-center text-sm text-muted hover:text-fg"
          rel="noopener noreferrer"
          target="_blank"
        >
          Oder per WhatsApp schreiben
        </a>
      </div>
    </form>
  );
}

export function PickupNote({ km, packageId }: { km: number; packageId?: PackageId }) {
  return <span>{pickupPriceText(km, packageId)}</span>;
}
