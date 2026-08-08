import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Camera,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { ConditionPhotoUpload, type UploadedPhoto } from "@/components/ConditionPhotoUpload";
import { diagnoseBackendError, type BackendErrorInfo } from "@/lib/backendErrors";
import { createBooking, getDayLoad } from "@/lib/bookings.functions";
import {
  calcLineItems,
  calcTotals,
  contactChannels,
  MAX_BOOKINGS_PER_DAY,
  TIME_NOTICE,
  type Booking,
  type ContactChannel,
} from "@/lib/bookings";
import { submitConditionReport } from "@/lib/conditionReports.functions";
import { validateCustomer, validateCustomerField, type CustomerField } from "@/lib/customerSchema";
import { pickupCitiesByDistance } from "@/lib/pickupLocations";
import {
  addOns,
  company,
  currency,
  depositConfig,
  getPickupPrice,
  isPickupIncluded,
  pickupTierSummary,
  servicePackages,
  vatNotice,
  vatNoticeShort,
  vehicleTypes,
} from "@/lib/servicesConfig";

const steps = ["Paket", "Fahrzeug", "Extras", "Fotos", "Wunschtermin", "Anfrage"];
const pickupAddOn = addOns.find((addOn) => addOn.distanceBased);

const vehicleIcons: Record<string, typeof Car> = {
  kompakt: Car,
  suv: Car,
  transporter: Truck,
};

function toISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatBookingDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("de-DE", { dateStyle: "full" });
}

function MiniCalendar({
  value,
  onChange,
  dayLoad,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  dayLoad: Record<string, number>;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1),
    ),
  ];

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-secondary/20 p-4 sm:p-6">
      <div className="mb-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <button
          type="button"
          aria-label="Vorheriger Monat"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="grid size-11 place-items-center rounded-xl border border-border bg-background/40 outline-none transition-colors hover:border-primary/50 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
          {cursor.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          aria-label="Nächster Monat"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="grid size-11 place-items-center rounded-xl border border-border bg-background/40 outline-none transition-colors hover:border-primary/50 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.6875rem] uppercase tracking-widest text-muted-foreground">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Verfügbare Wunschtermine">
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />;
          const iso = toISO(date);
          const used = dayLoad[iso] ?? 0;
          const full = used >= MAX_BOOKINGS_PER_DAY;
          const disabled = date < today || date.getDay() === 0 || full;
          const selected = iso === value;

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              aria-pressed={selected}
              aria-label={`${formatBookingDate(iso)}${full ? " – ausgebucht" : ""}`}
              className={[
                "aspect-square min-h-11 rounded-xl text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
                disabled
                  ? full
                    ? "cursor-not-allowed text-muted-foreground/30 line-through"
                    : "cursor-not-allowed text-muted-foreground/30"
                  : "hover:bg-secondary active:scale-95",
                selected
                  ? "bg-primary font-semibold text-primary-foreground glow-ring"
                  : "text-foreground/85",
              ].join(" ")}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BookingWizard() {
  const [step, setStep] = useState(0);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [pickupCity, setPickupCity] = useState("");
  const [conditionPhotos, setConditionPhotos] = useState<UploadedPhoto[]>([]);
  const [conditionNote, setConditionNote] = useState("");
  const [photosUploading, setPhotosUploading] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [preferredContact, setPreferredContact] = useState<ContactChannel>("E-Mail");
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", plate: "" });
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [touched, setTouched] = useState<Partial<Record<CustomerField, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<CustomerField, string>>>({});
  const [submitError, setSubmitError] = useState<BackendErrorInfo | null>(null);
  const [dayLoad, setDayLoad] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchDayLoad = useServerFn(getDayLoad);
  const submitBooking = useServerFn(createBooking);
  const sendConditionReport = useServerFn(submitConditionReport);

  useEffect(() => {
    void fetchDayLoad({})
      .then(setDayLoad)
      .catch(() => undefined);
  }, [fetchDayLoad]);

  useEffect(() => {
    if (step === 0) return;
    document.getElementById("booking-active-step")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [step]);

  const selectedPackage = servicePackages.find((pkg) => pkg.id === packageId) ?? null;
  const selectedVehicle = vehicleTypes.find((vehicle) => vehicle.id === vehicleId) ?? null;

  const includedAddOnIds = useMemo(
    () =>
      packageId
        ? addOns
            .filter(
              (addOn) =>
                !addOn.distanceBased && addOn.includedInPackages?.includes(packageId),
            )
            .map((addOn) => addOn.id)
        : [],
    [packageId],
  );

  const addOnIds = useMemo(
    () => Array.from(new Set([...selectedAddOnIds, ...includedAddOnIds])),
    [selectedAddOnIds, includedAddOnIds],
  );

  const pickupSelected = !!pickupAddOn && selectedAddOnIds.includes(pickupAddOn.id);
  const pickupCityData = pickupCitiesByDistance.find((city) => city.slug === pickupCity);
  const pickupDistanceKm = pickupCityData?.distanceKm ?? null;
  const pickupPrice = pickupDistanceKm === null ? null : getPickupPrice(pickupDistanceKm);
  const pickupIncluded =
    pickupDistanceKm !== null && isPickupIncluded(packageId, pickupDistanceKm);
  const pickupOnRequest =
    pickupSelected && !!pickupCityData && !pickupIncluded && pickupPrice === null;
  const pickupStepValid =
    !pickupSelected || (!!pickupCityData && (pickupIncluded || pickupPrice !== null));

  const items = useMemo(
    () =>
      vehicleId && packageId
        ? calcLineItems({ vehicleId, packageId, addOnIds, pickupCity: pickupCity || null })
        : [],
    [vehicleId, packageId, addOnIds, pickupCity],
  );
  const totals = calcTotals(items);

  const canContinue = [
    !!packageId,
    !!vehicleId,
    pickupStepValid,
    conditionPhotos.length > 0 && !photosUploading,
    !!date,
    Object.keys(validateCustomer(customer)).length === 0 && pickupStepValid,
  ][step];

  function updateCustomer(field: CustomerField, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const message = validateCustomerField(field, value);
      if (!message) return { ...current, [field]: undefined };
      return touched[field] ? { ...current, [field]: message } : current;
    });
  }

  function blurCustomer(field: CustomerField) {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({
      ...current,
      [field]: validateCustomerField(field, customer[field]),
    }));
  }

  function toggleAddOn(id: string, distanceBased = false) {
    setSelectedAddOnIds((current) => {
      const active = current.includes(id);
      if (active && distanceBased) setPickupCity("");
      return active ? current.filter((item) => item !== id) : [...current, id];
    });
  }

  async function submit() {
    if (!vehicleId || !packageId || !date || submitting) return;
    if (!pickupStepValid) {
      setStep(2);
      toast.error("Bitte wählen Sie einen gültigen Abholort.");
      return;
    }

    const fieldErrors = validateCustomer(customer);
    if (Object.keys(fieldErrors).length > 0) {
      setTouched({ name: true, email: true, phone: true, plate: true });
      setErrors(fieldErrors);
      toast.error("Bitte korrigieren Sie die markierten Felder.");
      return;
    }

    if (conditionPhotos.length === 0 || photosUploading) {
      setStep(3);
      toast.error("Bitte laden Sie mindestens ein Fahrzeugfoto hoch.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const booking = await submitBooking({
        data: {
          vehicleId,
          packageId,
          addOnIds,
          date,
          name: customer.name.trim(),
          email: customer.email.trim(),
          phone: customer.phone.trim(),
          plate: customer.plate.trim().toUpperCase(),
          pickupCity: pickupSelected ? pickupCity : null,
          preferredContact,
        },
      });

      try {
        await sendConditionReport({
          data: {
            name: customer.name.trim(),
            email: customer.email.trim(),
            phone: customer.phone.trim(),
            vehicle: selectedVehicle?.name ?? "",
            plate: customer.plate.trim().toUpperCase(),
            conditionText: conditionNote.trim(),
            photoPaths: conditionPhotos.map((photo) => photo.path),
            bookingId: booking.id,
          },
        });
      } catch (error) {
        console.error("[Zustandsmeldung] konnte nicht gespeichert werden", error);
      }

      setConfirmed(booking);
      toast.success("Anfrage gesendet – White Gloss prüft jetzt Ihren Wunschtermin.");
    } catch (error) {
      const info = diagnoseBackendError(error);
      setSubmitError(info);
      toast.error(info.description);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <>
        <Confirmation booking={confirmed} onReset={() => window.location.reload()} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  return (
    <>
      <div id="booking-active-step" className="mx-auto w-full max-w-4xl scroll-mt-28">
        <div className="mb-5 px-1 sm:mb-7">
          <div className="mb-3 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>Schritt {step + 1} von {steps.length}</span>
            <span className="font-semibold text-foreground">{steps[step]}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="glass rounded-3xl p-5 sm:p-8 lg:p-10">
          {step === 0 && (
            <section>
              <StepHeader
                eyebrow="1 · Leistung"
                title="Welches Paket passt zu Ihrem Fahrzeug?"
                text="Wählen Sie zuerst nur das gewünschte Ergebnis. Fahrzeuggröße, Extras und Fotos kommen danach – Schritt für Schritt."
              />

              <div className="mx-auto grid max-w-3xl gap-4">
                {servicePackages.map((pkg) => {
                  const active = packageId === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setPackageId(pkg.id)}
                      aria-pressed={active}
                      className={[
                        "relative rounded-2xl border p-5 text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring sm:p-6",
                        active
                          ? "border-primary bg-primary/10 glow-ring"
                          : "border-border bg-secondary/25 hover:border-primary/50 hover:bg-secondary/45",
                      ].join(" ")}
                    >
                      {pkg.highlight && (
                        <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-[0.625rem] font-semibold uppercase tracking-wider text-primary-foreground">
                          Beliebt
                        </span>
                      )}
                      <div className="pr-20">
                        <p className="display-card">{pkg.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{pkg.tagline}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground">ab</p>
                          <p className="display-price text-primary">{currency(pkg.basePrice)}</p>
                          <p className="text-xs text-muted-foreground">{vatNoticeShort()} · {pkg.duration}</p>
                        </div>
                        {active && (
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                            <CheckCircle2 className="size-4" /> Ausgewählt
                          </span>
                        )}
                      </div>
                      <ul className="mt-5 grid gap-2 text-sm text-foreground/80 sm:grid-cols-2">
                        {pkg.features.slice(0, 4).map((feature) => (
                          <li key={feature} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {pkg.features.length > 4 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          + {pkg.features.length - 4} weitere enthaltene Leistungen
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <StepHeader
                eyebrow="2 · Fahrzeug"
                title="Welche Fahrzeuggröße bringen Sie?"
                text={`Gewähltes Paket: ${selectedPackage?.name ?? "–"}. Jetzt wird der passende Endpreis für Ihre Fahrzeugklasse berechnet.`}
              />

              <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
                {vehicleTypes.map((vehicle) => {
                  const Icon = vehicleIcons[vehicle.id] ?? Car;
                  const active = vehicleId === vehicle.id;
                  const price = selectedPackage
                    ? Math.round(selectedPackage.basePrice * vehicle.factor)
                    : 0;
                  return (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => setVehicleId(vehicle.id)}
                      aria-pressed={active}
                      className={[
                        "rounded-2xl border p-5 text-center outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary bg-primary/10 glow-ring"
                          : "border-border bg-secondary/25 hover:border-primary/50 hover:bg-secondary/45",
                      ].join(" ")}
                    >
                      <Icon className={`mx-auto size-7 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="mt-4 font-semibold">{vehicle.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{vehicle.description}</p>
                      <p className="mt-4 display-price text-lg text-primary">{currency(price)}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <StepHeader
                eyebrow="3 · Zusatzleistungen"
                title="Möchten Sie etwas ergänzen?"
                text="Extras sind optional. Wählen Sie nur, was Sie wirklich brauchen – der Preis aktualisiert sich direkt."
              />

              <div className="mx-auto max-w-2xl space-y-3">
                {addOns.map((addOn) => {
                  const included = packageId
                    ? (addOn.includedInPackages?.includes(packageId) ?? false)
                    : false;
                  const fixedIncluded = included && !addOn.distanceBased;
                  const active = fixedIncluded || selectedAddOnIds.includes(addOn.id);
                  const factor = selectedVehicle?.factor ?? 1;

                  let priceLabel = `+${currency(Math.round(addOn.price * (addOn.flatPrice ? 1 : factor)))}`;
                  if (fixedIncluded) priceLabel = "Inklusive";
                  if (addOn.distanceBased) {
                    if (!active && included) priceLabel = "Im Paket inklusive";
                    else if (!active) priceLabel = "nach Entfernung";
                    else if (pickupDistanceKm === null) priceLabel = included ? "Inklusive" : "Ort wählen";
                    else if (pickupIncluded) priceLabel = "Inklusive";
                    else if (pickupPrice === null) priceLabel = "auf Anfrage";
                    else if (pickupPrice === 0) priceLabel = "Kostenlos";
                    else priceLabel = `+${currency(pickupPrice)}`;
                  }

                  return (
                    <button
                      key={addOn.id}
                      type="button"
                      disabled={fixedIncluded}
                      onClick={() => toggleAddOn(addOn.id, !!addOn.distanceBased)}
                      aria-pressed={active}
                      className={[
                        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring sm:p-5",
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/25 hover:border-primary/40 hover:bg-secondary/45",
                        fixedIncluded ? "cursor-default" : "",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">{addOn.name}</p>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">{addOn.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold text-primary">{priceLabel}</span>
                        <span
                          className={[
                            "grid size-8 place-items-center rounded-lg border",
                            active ? "border-primary bg-primary" : "border-border",
                          ].join(" ")}
                        >
                          {active ? (
                            <CheckCircle2 className="size-4 text-primary-foreground" />
                          ) : (
                            <Plus className="size-4 text-muted-foreground" />
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {pickupSelected && pickupAddOn && (
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
                    <Label htmlFor="pickup-city" className="text-xs uppercase tracking-widest text-muted-foreground">
                      Abholort
                    </Label>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {pickupTierSummary()}.
                    </p>
                    <div className="relative mt-3">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <select
                        id="pickup-city"
                        value={pickupCity}
                        onChange={(event) => setPickupCity(event.target.value)}
                        aria-invalid={!pickupStepValid ? true : undefined}
                        className="h-12 w-full rounded-xl border border-input bg-secondary/40 pl-9 pr-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Bitte Ort wählen …</option>
                        {pickupCitiesByDistance.map((city) => {
                          const price = getPickupPrice(city.distanceKm);
                          const free = isPickupIncluded(packageId, city.distanceKm);
                          const suffix = free
                            ? "im Paket inklusive"
                            : price === null
                              ? "auf Anfrage"
                              : price === 0
                                ? "kostenlos"
                                : currency(price);
                          return (
                            <option key={city.slug} value={city.slug}>
                              {city.name} · {city.distanceKm} km · {suffix}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {pickupOnRequest && (
                      <p role="alert" className="mt-3 text-sm text-destructive">
                        Dieser Ort liegt außerhalb unserer festen Preisstaffel. Bitte wählen Sie einen anderen Ort oder kontaktieren Sie uns direkt unter {company.email}.
                      </p>
                    )}
                  </div>
                )}

                {items.length > 0 && (
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/25 px-5 py-4">
                    <span className="text-sm text-muted-foreground">Aktueller Gesamtpreis</span>
                    <span className="display-price text-xl text-primary">{currency(totals.gross)}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <StepHeader
                eyebrow="4 · Fahrzeugzustand"
                title="Jetzt die Fotos – danach können wir seriös prüfen"
                text="Mindestens ein Foto ist erforderlich. Ideal sind Gesamtansichten und Nahaufnahmen von Kratzern, Flecken oder besonders verschmutzten Stellen."
              />

              <div className="mx-auto max-w-2xl">
                <div className="mb-5 rounded-2xl border border-border bg-secondary/20 p-4 text-sm leading-6 text-muted-foreground">
                  <div className="flex gap-3">
                    <Camera className="mt-0.5 size-5 shrink-0 text-primary" />
                    <p>
                      Die Aufnahmen sind privat und nur für die Angebotsprüfung im Admin-Bereich sichtbar. Sie helfen dabei, Mehraufwand vor dem Termin zu erkennen.
                    </p>
                  </div>
                </div>

                <ConditionPhotoUpload
                  photos={conditionPhotos}
                  onChange={setConditionPhotos}
                  onUploadingChange={setPhotosUploading}
                  inputId="buchung-zustand-fotos"
                  hint="Empfohlen: Fahrzeug schräg vorne, schräg hinten und Detailaufnahmen auffälliger Stellen."
                />

                <div className="mt-6">
                  <Label htmlFor="buchung-zustand-notiz" className="text-xs uppercase tracking-widest text-muted-foreground">
                    Kurze Anmerkung (optional)
                  </Label>
                  <Textarea
                    id="buchung-zustand-notiz"
                    value={conditionNote}
                    onChange={(event) => setConditionNote(event.target.value)}
                    rows={4}
                    maxLength={4000}
                    placeholder="z. B. Flecken auf den Sitzen, Kratzer an der Motorhaube, Tierhaare im Innenraum …"
                    className="mt-2 bg-secondary/40"
                  />
                </div>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                  {conditionPhotos.length === 0
                    ? "Bitte laden Sie mindestens eine Aufnahme hoch, um fortzufahren."
                    : `${conditionPhotos.length} Aufnahme${conditionPhotos.length === 1 ? "" : "n"} bereit.`}
                </p>
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <StepHeader
                eyebrow="5 · Wunschtermin"
                title="Welcher Tag wäre für Sie ideal?"
                text="Sie wählen hier nur Ihren Wunschtermin. White Gloss prüft die Anfrage anschließend und bestätigt den finalen Termin als Admin."
              />

              <MiniCalendar value={date} onChange={setDate} dayLoad={dayLoad} />

              <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-primary/25 bg-primary/5 p-5 text-center">
                <CalendarIcon className="mx-auto size-5 text-primary" />
                {date ? (
                  <>
                    <p className="mt-2 font-semibold">{formatBookingDate(date)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Wunschtermin ausgewählt · noch nicht verbindlich bestätigt
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Bitte wählen Sie einen verfügbaren Tag.</p>
                )}
                <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                  {TIME_NOTICE}
                </p>
              </div>
            </section>
          )}

          {step === 5 && (
            <section>
              <StepHeader
                eyebrow="6 · Anfrage senden"
                title="Noch Ihre Kontaktdaten – dann prüfen wir alles"
                text="Nach dem Absenden erhalten Sie sofort eine Eingangsbestätigung. Der Termin wird erst durch die anschließende Freigabe von White Gloss verbindlich."
              />

              <div className="mx-auto max-w-2xl">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="name"
                    label="Name"
                    icon={User}
                    value={customer.name}
                    placeholder="Max Mustermann"
                    onChange={(value) => updateCustomer("name", value)}
                    onBlur={() => blurCustomer("name")}
                    error={errors.name}
                  />
                  <Field
                    id="email"
                    label="E-Mail"
                    icon={Mail}
                    type="email"
                    value={customer.email}
                    placeholder="max@beispiel.de"
                    onChange={(value) => updateCustomer("email", value)}
                    onBlur={() => blurCustomer("email")}
                    error={errors.email}
                  />
                  <Field
                    id="phone"
                    label="Telefon"
                    icon={Phone}
                    value={customer.phone}
                    placeholder="+49 176 12345678"
                    onChange={(value) => updateCustomer("phone", value)}
                    onBlur={() => blurCustomer("phone")}
                    error={errors.phone}
                  />
                  <Field
                    id="plate"
                    label="Kennzeichen"
                    icon={Car}
                    value={customer.plate}
                    placeholder="FDS-WG 26"
                    onChange={(value) => updateCustomer("plate", value)}
                    onBlur={() => blurCustomer("plate")}
                    error={errors.plate}
                  />
                </div>

                <fieldset className="mt-6 rounded-2xl border border-border bg-secondary/20 p-5">
                  <legend className="px-2 text-xs uppercase tracking-widest text-muted-foreground">
                    Bevorzugter Kontaktweg
                  </legend>
                  <div className="flex flex-wrap justify-center gap-2">
                    {contactChannels.map((channel) => {
                      const active = preferredContact === channel;
                      return (
                        <button
                          key={channel}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setPreferredContact(channel)}
                          className={[
                            "min-h-11 rounded-xl border px-5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? "border-primary bg-primary text-primary-foreground glow-ring"
                              : "border-border bg-background/30 hover:border-primary/50 hover:bg-secondary",
                          ].join(" ")}
                        >
                          {channel}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <ReviewSummary
                  packageName={selectedPackage?.name ?? "–"}
                  vehicleName={selectedVehicle?.name ?? "–"}
                  addOnIds={addOnIds}
                  date={date}
                  total={totals.gross}
                  photoCount={conditionPhotos.length}
                />

                <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                  <div className="flex gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold">Wichtig: Dies ist noch keine Terminbestätigung.</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        White Gloss prüft Fotos, Leistungsumfang, Preis und Wunschtermin. Sie erhalten danach die verbindliche Bestätigung oder ein Gegenangebot mit möglichen Ersatzterminen per E-Mail.
                      </p>
                    </div>
                  </div>
                </div>

                {submitError && (
                  <div role="alert" className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    <p className="font-medium">{submitError.title}</p>
                    <p className="mt-1">{submitError.description}</p>
                    {submitError.hint && <p className="mt-2 text-xs">{submitError.hint}</p>}
                  </div>
                )}

                <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                  Mit dem Absenden stimmen Sie der Verarbeitung Ihrer Angaben und Fahrzeugaufnahmen zur Bearbeitung Ihrer Anfrage zu.
                </p>
              </div>
            </section>
          )}

          <div className="mt-8 flex flex-col-reverse items-stretch justify-center gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
            {step > 0 && (
              <Button
                variant="ghost"
                className="sm:min-w-36"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
              >
                <ArrowLeft className="size-4" />
                Zurück
              </Button>
            )}

            {step < steps.length - 1 ? (
              <Button
                className="sm:min-w-44"
                disabled={!canContinue}
                onClick={() => setStep((current) => current + 1)}
              >
                Weiter
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button className="sm:min-w-52" disabled={!canContinue || submitting} onClick={submit}>
                {submitting ? "Wird gesendet …" : "Terminanfrage senden"}
                {submitting ? null : <CheckCircle2 className="size-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>
      <Toaster position="top-center" richColors />
    </>
  );
}

function StepHeader({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="mx-auto mb-7 max-w-2xl text-center sm:mb-9">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h3 className="display-sub mt-2">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
  onBlur,
  error,
}: {
  id: string;
  label: string;
  icon: typeof User;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  onBlur?: () => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          value={value}
          maxLength={120}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-12 bg-secondary/40 pl-9 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewSummary({
  packageName,
  vehicleName,
  addOnIds,
  date,
  total,
  photoCount,
}: {
  packageName: string;
  vehicleName: string;
  addOnIds: string[];
  date: string | null;
  total: number;
  photoCount: number;
}) {
  const selectedAddOns = addOns.filter((addOn) => addOnIds.includes(addOn.id));

  return (
    <div className="mt-6 rounded-2xl border border-border bg-secondary/20 p-5">
      <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        Ihre Anfrage im Überblick
      </p>
      <dl className="mt-5 space-y-3 text-sm">
        <ReviewRow label="Paket" value={packageName} />
        <ReviewRow label="Fahrzeug" value={vehicleName} />
        <ReviewRow
          label="Extras"
          value={selectedAddOns.length ? selectedAddOns.map((addOn) => addOn.name).join(", ") : "Keine"}
        />
        <ReviewRow label="Fotos" value={`${photoCount} Aufnahme${photoCount === 1 ? "" : "n"}`} />
        <ReviewRow label="Wunschtermin" value={date ? formatBookingDate(date) : "–"} />
      </dl>
      <div className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-sm font-semibold">Voraussichtlicher Gesamtpreis</p>
          <p className="mt-1 text-xs text-muted-foreground">{vatNotice()}</p>
        </div>
        <p className="display-price shrink-0 text-xl text-primary">{currency(total)}</p>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Confirmation({ booking, onReset }: { booking: Booking; onReset: () => void }) {
  const items = calcLineItems(booking);
  const totals = calcTotals(items);
  const pickupCityName = booking.pickupCity
    ? (pickupCitiesByDistance.find((city) => city.slug === booking.pickupCity)?.name ?? null)
    : null;

  return (
    <div className="glass-strong mx-auto max-w-2xl rounded-3xl p-6 text-center sm:p-10">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/15 glow-ring">
        <CheckCircle2 className="size-8 text-primary" />
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Anfrage erfolgreich gesendet</p>
      <h3 className="display-sub mt-2">Wir prüfen jetzt Ihre Buchung</h3>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-muted-foreground">
        Vielen Dank, {booking.customer.name}. Ihre Anfrage und der Wunschtermin sind bei White Gloss eingegangen. Erst die anschließende E-Mail nach unserer Prüfung bestätigt den Termin verbindlich.
      </p>

      <dl className="mt-8 grid gap-3 rounded-2xl bg-secondary/40 p-5 text-left text-sm">
        <Detail label="Anfragenummer" value={booking.invoiceNumber} />
        <Detail label="Wunschtermin" value={formatBookingDate(booking.date)} />
        <Detail label="Kennzeichen" value={booking.customer.plate} />
        {pickupCityName && <Detail label="Gewünschte Abholung" value={pickupCityName} />}
        {items.map((item) => (
          <Detail key={item.label} label={item.label} value={currency(item.total)} />
        ))}
        <div className="mt-2 flex justify-between gap-4 border-t border-border pt-3 font-semibold">
          <span>Voraussichtlicher Gesamtpreis</span>
          <span className="text-primary">{currency(totals.gross)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{vatNotice()}</p>
      </dl>

      <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-left">
        <p className="font-semibold">So geht es weiter</p>
        <ol className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>1. White Gloss prüft Ihre Fahrzeugfotos, Leistungen und den Wunschtermin.</li>
          <li>2. Sie erhalten die verbindliche Bestätigung oder ein Gegenangebot mit Ersatzterminen per E-Mail.</li>
          <li>3. Erst nach Ihrer bzw. unserer finalen Bestätigung ist der Termin fest reserviert.</li>
        </ol>
      </div>

      {booking.depositAmount > 0 && (
        <p className="mx-auto mt-4 max-w-xl rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-left text-sm text-amber-200">
          Für Neukunden wird nach der Terminfreigabe eine Anzahlung von <strong>{currency(booking.depositAmount)}</strong> fällig. Die Zahlungsinformationen erhalten Sie erst mit der verbindlichen Bestätigung.
        </p>
      )}

      <p className="mt-5 text-sm leading-6 text-muted-foreground">{TIME_NOTICE}</p>

      <Button className="mt-7" variant="outline" onClick={onReset}>
        Neue Anfrage
      </Button>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="shrink-0 text-right font-medium">{value}</dd>
    </div>
  );
}
