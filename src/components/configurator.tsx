import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  cities,
  paymentNote,
  extras,
  extraIncluded,
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
import { isCalendarDate } from "@/lib/calendar-date";
import { queueBookingConversion } from "@/lib/googleTag";
import { bookingRequestId } from "@/lib/booking-request-id";
import { applyBookingSelection } from "@/lib/booking-selection";
import { usePublicFormErrors } from "./public-form-feedback";
import { BookingMediaPicker, mediaBase64 } from "./booking-media-picker";
import { Button, Field, inputLine } from "./ui";
import { useBookingDraft, clearBookingDraft, appliedBookingEntries } from "./booking-draft";
import { berlinWallToUtc, defaultWorkEnd, rangesOverlap } from "@/lib/booking-time";

export function Configurator({
  initialPackage,
  initialCity,
}: {
  initialPackage?: PackageId;
  initialCity?: string;
}) {
  const navigate = useNavigate();
  const entryKey = useRouterState({
    select: (state) => state.location.state.__TSR_key ?? state.location.href,
  });
  const [packageId, setPackageId] = useBookingDraft<PackageId>(
    "packageId",
    initialPackage ?? "premium",
  );
  const [step, setStep] = useState(1);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  function changeStep(next: number) {
    setStep(next);
    window.requestAnimationFrame(() => {
      stepHeading.current?.focus({ preventScroll: true });
      stepHeading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  const [classId, setClassId] = useBookingDraft<VehicleClass["id"]>("classId", "kompakt");
  const [extraIds, setExtraIds] = useBookingDraft<string[]>("extraIds", []);
  const [citySlug, setCitySlug] = useBookingDraft("citySlug", initialCity ?? "horb-am-neckar");
  const [name, setName] = useBookingDraft("name", "");
  const [phone, setPhone] = useBookingDraft("phone", "");
  const [email, setEmail] = useBookingDraft("email", "");
  const [date, setDate] = useBookingDraft("date", "");
  const [slot, setSlot] = useBookingDraft("slot", "");
  const [note, setNote] = useBookingDraft("note", "");
  const [vehicleMake, setVehicleMake] = useBookingDraft("vehicleMake", "");
  const [vehicleModel, setVehicleModel] = useBookingDraft("vehicleModel", "");
  const [vehiclePlate, setVehiclePlate] = useBookingDraft("vehiclePlate", "");
  const [busyWindows, setBusyWindows] = useState<{ start: string; end: string }[]>([]);
  const [availabilityState, setAvailabilityState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [privacy, setPrivacy] = useBookingDraft("privacy", false);
  const [reviewEmailConsent, setReviewEmailConsent] = useBookingDraft("reviewEmailConsent", false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [media, setMedia] = useBookingDraft<File[]>("media", []);
  const [savedReference, setSavedReference] = useState<string | null>(null);
  const saved = useRef<{ reference: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const { fieldProps, fieldError, showErrors } = usePublicFormErrors();
  const formRef = useRef<HTMLFormElement>(null);
  const [priceBarVisible, setPriceBarVisible] = useState(false);
  const [priceDetailsOpen, setPriceDetailsOpen] = useState(false);

  // The mobile price bar follows the same visibility window as the WhatsApp
  // button, which hides while the form fills the upper part of the screen.
  useEffect(() => {
    const form = formRef.current;
    if (!form || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setPriceBarVisible(entry.isIntersecting);
        if (!entry.isIntersecting) setPriceDetailsOpen(false);
      },
      { rootMargin: "0px 0px -55% 0px" },
    );
    observer.observe(form);
    return () => observer.disconnect();
  }, []);
  // The lazily mounted form is not known to the WhatsApp button's observer.
  useEffect(() => {
    const root = document.documentElement;
    if (priceBarVisible) root.dataset.bookingBar = "visible";
    else delete root.dataset.bookingBar;
    return () => {
      delete root.dataset.bookingBar;
    };
  }, [priceBarVisible]);

  useEffect(() => {
    if (appliedBookingEntries.has(entryKey) || pending || savedReference) return;
    appliedBookingEntries.add(entryKey);
    const selection = applyBookingSelection(
      { packageId, citySlug },
      { paket: initialPackage, ort: initialCity },
    );
    setPackageId(selection.packageId);
    setCitySlug(selection.citySlug);
  }, [
    entryKey,
    initialPackage,
    initialCity,
    packageId,
    citySlug,
    pending,
    savedReference,
    setPackageId,
    setCitySlug,
  ]);

  useEffect(() => {
    setExtraIds((current) => {
      const remaining = current.filter(
        (id) =>
          extras.some((extra) => extra.id === id && extra.requestable !== false) &&
          !extraIncluded(packageId, id),
      );
      return remaining.length === current.length ? current : remaining;
    });
  }, [packageId, setExtraIds]);

  useEffect(() => {
    const controller = new AbortController();
    const from = isCalendarDate(date)
      ? date
      : new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    const until = new Date(`${from}T12:00:00Z`);
    until.setUTCDate(until.getUTCDate() + 60);
    const to = until.toISOString().slice(0, 10);
    setAvailabilityState("loading");
    let refreshing = false;
    const refresh = () => {
      if (refreshing || controller.signal.aborted) return;
      refreshing = true;
      void fetch(`/api/availability?from=${from}&to=${to}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("unavailable");
          return response.json();
        })
        .then((payload: { ok: boolean; windows?: { start: string; end: string }[] }) => {
          if (controller.signal.aborted) return;
          if (!payload.ok || !Array.isArray(payload.windows)) throw new Error("unavailable");
          setBusyWindows(payload.windows);
          setAvailabilityState("ready");
        })
        .catch(() => {
          if (!controller.signal.aborted) setAvailabilityState("error");
        })
        .finally(() => {
          refreshing = false;
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [date]);
  const blockedSlots = useMemo(() => {
    if (!isCalendarDate(date)) return [];
    return timeSlots.filter((time) => {
      const start = berlinWallToUtc(date, time),
        end = defaultWorkEnd(packageId, start);
      return busyWindows.some((window) =>
        rangesOverlap(start, end, new Date(window.start), new Date(window.end)),
      );
    });
  }, [date, packageId, busyWindows]);

  const quote = useMemo(
    () => quoteTotal({ packageId, classId, extraIds, citySlug }),
    [packageId, classId, extraIds, citySlug],
  );

  function toggleExtra(id: string) {
    if (extraIncluded(packageId, id)) return;
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    if (step < 2) {
      changeStep(step + 1);
      return;
    }
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
    if (!saved.current && slot && (blockedSlots.includes(slot) || availabilityState !== "ready"))
      errors.date =
        "Bitte wählen Sie eine verfügbare Abgabezeit oder fragen Sie ohne feste Uhrzeit an.";
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
            extraIds: extraIds.filter((id) => !extraIncluded(packageId, id)),
            citySlug,
            vehicleMake: vehicleMake.trim() || undefined,
            vehicleModel: vehicleModel.trim() || undefined,
            vehiclePlate: vehiclePlate.trim() || undefined,
            kind: "booking",
            privacy: true as const,
            reviewEmailConsent,
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
      clearBookingDraft();
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

  const locked = pending || savedReference !== null;
  const selectedExtras = extras.filter(
    (ex) => extraIds.includes(ex.id) && !extraIncluded(packageId, ex.id),
  );
  const requestableCount = extras.filter((ex) => ex.requestable !== false).length;
  const priceLines = (
    <dl className="booking-lines">
      <div>
        <dt>Fahrzeug</dt>
        <dd>{quote.klass.label}</dd>
      </div>
      <div>
        <dt>{quote.pack.name}</dt>
        <dd>{eur(quote.pack.price * quote.klass.factor)}</dd>
      </div>
      {selectedExtras.map((ex) => (
        <div key={ex.id}>
          <dt>{ex.name}</dt>
          <dd>{eur(ex.price * quote.klass.factor)}</dd>
        </div>
      ))}
      <div>
        <dt>Abholung · {quote.city?.name}</dt>
        <dd>{quote.pickupOnRequest ? "nach Absprache" : eur(quote.pickup ?? 0)}</dd>
      </div>
    </dl>
  );
  const priceTerms = `${site.vatNote}${quote.pickupOnRequest ? " · zzgl. Abholung nach Absprache" : ""}`;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      data-hide-whatsapp
      aria-labelledby="buchung-heading"
      aria-label="Unverbindliche Terminanfrage"
      className="booking-flow"
    >
      <nav aria-label="Schritte der Terminanfrage" className="booking-steps">
        {["Ihre Auswahl", "Kontakt & Termin"].map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={step === index + 1 ? "step" : undefined}
            disabled={locked}
            onClick={() => changeStep(index + 1)}
          >
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span> {label}
          </button>
        ))}
      </nav>
      <div className="booking-layout">
        <div className="booking-main">
          <h3 ref={stepHeading} tabIndex={-1} className="booking-step-title">
            {step === 1 ? "Ihre Auswahl" : "Kontakt & Termin"}
          </h3>
          <div hidden={step !== 1} className="booking-stage">
            <fieldset className="booking-group">
              <legend className="booking-legend">
                <span aria-hidden="true">01</span> Fahrzeug
              </legend>
              <div className="booking-choices booking-choices--vehicle">
                {vehicleClasses.map((c) => (
                  <label key={c.id} className="booking-choice" data-selected={classId === c.id}>
                    <input
                      disabled={locked}
                      type="radio"
                      name="klasse"
                      value={c.id}
                      checked={classId === c.id}
                      onChange={() => setClassId(c.id)}
                    />
                    <span className="booking-choice-copy">
                      <span className="booking-choice-name">{c.label}</span>
                      <span className="booking-choice-hint">{c.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="booking-group">
              <legend className="booking-legend">
                <span aria-hidden="true">02</span> Paket
              </legend>
              <div className="booking-choices">
                {packages.map((p) => (
                  <label key={p.id} className="booking-choice" data-selected={packageId === p.id}>
                    <input
                      disabled={locked}
                      type="radio"
                      name="paket"
                      value={p.id}
                      checked={packageId === p.id}
                      onChange={() => setPackageId(p.id)}
                    />
                    <span className="booking-choice-copy">
                      <span className="booking-choice-meta">
                        {p.searchLabel}
                        {p.featured ? <span className="booking-choice-tag">Empfohlen</span> : null}
                      </span>
                      <span className="booking-choice-name">{p.name}</span>
                      <span className="booking-choice-hint">{p.kicker}</span>
                      <span className="booking-choice-price">
                        <span>ab</span> {eur(p.price * quote.klass.factor)}
                        <span> · {p.duration}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="booking-group">
              <legend className="booking-legend">
                <span aria-hidden="true">03</span> Zusatzleistungen
                <small>
                  optional · {requestableCount} Leistungen · Preise für {quote.klass.label}
                </small>
              </legend>
              {(["pflege", "reparatur"] as const).map((group) => (
                <div key={group} className="booking-extra-group">
                  <p className="booking-extra-group-title">
                    {group === "pflege" ? "Pflege" : "Reparatur"}
                  </p>
                  <ul className="booking-extra-list">
                    {extras
                      .filter((ex) => ex.group === group && ex.requestable !== false)
                      .map((ex) => {
                        const included = extraIncluded(packageId, ex.id);
                        const checked = extraIds.includes(ex.id) || included;
                        return (
                          <li key={ex.id}>
                            <label
                              className="booking-extra"
                              data-selected={checked}
                              data-included={included || undefined}
                            >
                              <input
                                disabled={locked || included}
                                id={`extra-${ex.id}`}
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleExtra(ex.id)}
                              />
                              <span className="booking-extra-copy">
                                <span className="booking-extra-name">{ex.name}</span>
                                <span className="booking-extra-hint">
                                  {ex.hint}
                                  {packageId === "keramik" && ex.id === "felgen"
                                    ? " · Felgenversiegelung ist im Paket enthalten; dieses Extra umfasst zusätzlich die Demontage und Tiefenreinigung."
                                    : ""}
                                  {packageId === "keramik" && ex.id === "leder"
                                    ? " · Lederpflege ist im Paket enthalten. Einen darüber hinausgehenden Aufwand stimmen wir nach der Begutachtung mit Ihnen ab."
                                    : ""}
                                  {ex.inspect ? " · nach Prüfung" : ""}
                                </span>
                              </span>
                              <span className="booking-extra-price">
                                {included
                                  ? "Im Paket enthalten"
                                  : `ab ${eur(ex.price * quote.klass.factor)}`}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </fieldset>

            <div className="booking-group">
              <p className="booking-legend">
                <span aria-hidden="true">04</span> Hol- und Bringservice
              </p>
              <Field tone="public" id="city" label="Abholort">
                <select
                  disabled={locked}
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
              <p className="booking-pickup-note">
                {quote.city
                  ? `Abholung ab ${quote.city.name}: ${pickupPriceText(quote.city.km, packageId)}.`
                  : null}{" "}
                Abholort und Übergabezeit stimmen wir persönlich mit Ihnen ab.
              </p>
            </div>
          </div>

          <div hidden={step !== 2} className="booking-contact">
            <p className="booking-contact-lead">
              Dies ist der voraussichtliche Preis inkl. MwSt. Falls der Fahrzeugzustand zusätzlichen
              Aufwand erfordert, stimmen wir den Endpreis nach der Begutachtung mit Ihnen ab.{" "}
              {paymentNote}
            </p>
            <div className="booking-fields">
              <Field tone="public" id="name" label="Name (Pflichtfeld)">
                <input
                  disabled={locked}
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
              <Field tone="public" id="phone" label="Telefon (Pflichtfeld)">
                <input
                  disabled={locked}
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
                  disabled={locked}
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
            </div>
            <details className="booking-more">
              <summary>Weitere Fahrzeugangaben (optional)</summary>
              <div className="booking-fields">
                <Field tone="public" id="vehicleMake" label="Fahrzeugmarke (optional)">
                  <input
                    disabled={locked}
                    id="vehicleMake"
                    className={inputLine}
                    maxLength={80}
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                  />
                </Field>
                <Field tone="public" id="vehicleModel" label="Fahrzeugmodell (optional)">
                  <input
                    disabled={locked}
                    id="vehicleModel"
                    className={inputLine}
                    maxLength={80}
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                  />
                </Field>
                <Field tone="public" id="vehiclePlate" label="Kennzeichen (optional)">
                  <input
                    disabled={locked}
                    id="vehiclePlate"
                    className={inputLine}
                    maxLength={20}
                    autoComplete="off"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                  />
                </Field>
              </div>
            </details>
            <div className="booking-fields">
              <Field tone="public" id="date" label="Wunschtermin (optional)">
                <input
                  disabled={locked}
                  id="date"
                  type="date"
                  {...fieldProps("date")}
                  className={inputLine}
                  min={new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" })}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                {fieldError("date")}
                {date && blockedSlots.length > 0 ? (
                  <p className="text-xs text-muted">
                    Einige Zeiträume sind bereits belegt. Bitte wählen Sie eine verfügbare
                    Abgabezeit oder fragen Sie ohne feste Uhrzeit an.
                  </p>
                ) : null}
              </Field>
              <Field tone="public" id="slot" label="Gewünschte Abgabezeit (optional)">
                <select
                  disabled={locked || availabilityState !== "ready"}
                  id="slot"
                  className={inputLine}
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                >
                  <option value="">Keine Angabe</option>
                  {timeSlots.map((s) => {
                    const isBlocked = Boolean(
                      date && availabilityState === "ready" && blockedSlots.includes(s),
                    );
                    return (
                      <option key={s} value={s} disabled={isBlocked}>
                        {s} Uhr{isBlocked ? " - belegt" : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-muted">
                  {availabilityState === "loading"
                    ? "Freie Zeiträume werden geprüft …"
                    : "Die Auswahl berücksichtigt die vorläufige Paketdauer. Die endgültige Arbeitszeit und Terminbestätigung folgen nach unserer Prüfung."}
                </p>
              </Field>
            </div>
            {availabilityState !== "ready" ? (
              <p role="status" className="text-xs text-muted">
                {availabilityState === "loading"
                  ? "Verfügbarkeit wird geprüft …"
                  : "Die Kalenderprüfung ist vorübergehend nicht verfügbar. Eine Anfrage ohne feste Uhrzeit ist möglich."}
              </p>
            ) : null}
            <Field tone="public" id="note" label="Ihre Nachricht (optional)">
              <textarea
                disabled={locked}
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
                disabled={locked}
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
            <section aria-label="Zusammenfassung Ihrer Anfrage" className="booking-overview">
              <h4>Ihre Anfrage im Überblick</h4>
              <dl className="booking-summary">
                <dt>Paket · {quote.klass.label}</dt>
                <dd>
                  {quote.pack.name} · {eur(quote.pack.price * quote.klass.factor)}
                </dd>
                {selectedExtras.map((ex) => (
                  <div key={ex.id}>
                    <dt>{ex.name}</dt>
                    <dd>{eur(ex.price * quote.klass.factor)}</dd>
                  </div>
                ))}
                <dt>Abholung · {quote.city?.name}</dt>
                <dd>{quote.pickupOnRequest ? "Preis nach Absprache" : eur(quote.pickup ?? 0)}</dd>
                <dt>Gesamtpreis (voraussichtlich)</dt>
                <dd>
                  {eur(quote.total)}
                  {quote.pickupOnRequest ? " zzgl. Abholung" : ""}
                </dd>
                <dt>Kontakt</dt>
                <dd>
                  {name || "Bitte Namen ergänzen"} · {phone || "Bitte Telefon ergänzen"}
                  {email ? ` · ${email}` : ""}
                </dd>
                <dt>Wunschtermin</dt>
                <dd>
                  {date || "Nach Absprache"}
                  {slot ? ` · ${slot} Uhr` : ""}
                </dd>
                <dt>Aufnahmen</dt>
                <dd>{media.length} ausgewählt</dd>
              </dl>
            </section>
            <p className="text-sm text-muted">
              So geht es weiter: Wir prüfen Ihre Fotos, Leistungen und den Wunschtermin. Erst nach
              unserer Prüfung stimmen wir den verbindlichen Preis und Termin mit Ihnen ab. Die
              Rechnung folgt nach erbrachter Leistung.
            </p>
            <label htmlFor="privacy" className="booking-consent">
              <input
                disabled={locked}
                id="privacy"
                {...fieldProps("privacy")}
                type="checkbox"
                checked={privacy}
                onChange={(e) => setPrivacy(e.target.checked)}
                required
              />
              <span>
                Ich habe die{" "}
                <Link to="/datenschutz" className="underline hover:text-fg">
                  Datenschutzerklärung
                </Link>{" "}
                zur Kenntnis genommen (Pflichtfeld). Die Anfrage ist unverbindlich.{" "}
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
            <label className="booking-consent">
              <input
                type="checkbox"
                checked={reviewEmailConsent}
                onChange={(e) => setReviewEmailConsent(e.target.checked)}
              />
              <span>
                Ich möchte sieben Tage nach dem abgeschlossenen Auftrag einmalig per E-Mail um
                ehrliches Feedback und eine Google-Bewertung gebeten werden. Freiwillig und
                jederzeit widerrufbar.
              </span>
            </label>
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
              className="booking-submit w-full"
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
          <div className="booking-nav">
            {step > 1 && !savedReference ? (
              <Button
                tone="public"
                variant="line"
                type="button"
                disabled={pending}
                onClick={() => changeStep(step - 1)}
              >
                Zurück zur Auswahl
              </Button>
            ) : (
              <span />
            )}
            {step < 2 ? (
              <Button tone="public" type="button" onClick={() => changeStep(step + 1)}>
                Weiter zu Kontakt & Termin
              </Button>
            ) : null}
          </div>
        </div>

        <aside className="booking-aside" aria-label="Ihre Auswahl und voraussichtlicher Preis">
          <p className="booking-aside-kicker">Ihre Auswahl</p>
          {priceLines}
          <div className="booking-total" aria-live="polite" aria-atomic="true">
            <span className="booking-total-label">Voraussichtlich</span>
            <strong>
              <span>ab</span> {eur(quote.total)}
            </strong>
          </div>
          <p className="booking-total-terms">{priceTerms}</p>
          <p className="booking-total-note">
            Den verbindlichen Preis stimmen wir nach der Fahrzeugprüfung mit Ihnen ab.
          </p>
          {step === 1 ? (
            <button
              type="button"
              className="booking-aside-action"
              disabled={locked}
              onClick={() => changeStep(2)}
            >
              Weiter zur Anfrage
            </button>
          ) : (
            <button
              type="button"
              className="booking-aside-back"
              disabled={locked}
              onClick={() => changeStep(1)}
            >
              Auswahl ändern
            </button>
          )}
        </aside>
      </div>

      <div
        className="booking-pricebar"
        data-visible={priceBarVisible}
        data-open={priceDetailsOpen}
        onKeyDown={(e) => {
          if (e.key === "Escape" && priceDetailsOpen) {
            e.stopPropagation();
            setPriceDetailsOpen(false);
          }
        }}
      >
        <div
          id="booking-price-details"
          className="booking-pricebar-details"
          hidden={!priceDetailsOpen}
        >
          <p className="booking-aside-kicker">Preisdetails</p>
          {priceLines}
          <p className="booking-total-terms">{priceTerms}</p>
        </div>
        <div className="booking-pricebar-row">
          <button
            type="button"
            className="booking-pricebar-toggle"
            aria-expanded={priceDetailsOpen}
            aria-controls="booking-price-details"
            onClick={() => setPriceDetailsOpen((open) => !open)}
          >
            <span className="booking-pricebar-label">Voraussichtlich ab</span>
            <strong>{eur(quote.total)}</strong>
            <span className="booking-pricebar-more">
              {priceDetailsOpen ? "Details schließen" : "Preisdetails"}
            </span>
          </button>
          {step === 1 ? (
            <button
              type="button"
              className="booking-pricebar-action"
              disabled={locked}
              onClick={() => {
                setPriceDetailsOpen(false);
                changeStep(2);
              }}
            >
              Weiter zur Anfrage
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export function PickupNote({ km, packageId }: { km: number; packageId?: PackageId }) {
  return <span>{pickupPriceText(km, packageId)}</span>;
}
