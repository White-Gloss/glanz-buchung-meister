import { useEffect, useMemo, useState } from "react";
import { diagnoseBackendError, type BackendErrorInfo } from "@/lib/backendErrors";

import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Truck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  addOns,
  company,
  depositConfig,
  currency,
  getPickupPrice,
  isPickupIncluded,
  pickupPricing,
  pickupTierSummary,
  servicePackages,
  timeSlots,
  vatNotice,
  vatNoticeShort,
  vehicleTypes,
} from "@/lib/servicesConfig";
import { pickupCitiesByDistance } from "@/lib/pickupLocations";
import { calcLineItems, calcTotals, type Booking } from "@/lib/bookings";
import { validateCustomer, validateCustomerField, type CustomerField } from "@/lib/customerSchema";

import { createBooking, getBookedSlots } from "@/lib/bookings.functions";
import { reportAdsConversion } from "@/components/CookieConsent";
import { useServerFn } from "@tanstack/react-start";

/** Die entfernungsabhängige Zusatzleistung (Hol- & Bringservice). */
const pickupAddOn = addOns.find((a) => a.distanceBased);
const steps = ["Fahrzeug", "Paket", "Extras", "Termin", "Kontakt"];

const vehicleIcons: Record<string, typeof Car> = {
  kompakt: Car,
  suv: Car,
  transporter: Truck,
};

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MiniCalendar({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Montag zuerst
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1),
    ),
  ];

  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <button
          type="button"
          aria-label="Vorheriger Monat"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-secondary/50 outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:size-9"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="label-caps truncate text-center text-base">
          {cursor.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          aria-label="Nächster Monat"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-secondary/50 outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:size-9"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.6875rem] uppercase tracking-widest text-muted-foreground">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Verfügbare Termine">
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const iso = toISO(date);
          const disabled = date < today || date.getDay() === 0;
          const selected = iso === value;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              aria-pressed={selected}
              aria-label={new Date(iso).toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              className={[
                "aspect-square min-h-11 rounded-lg text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0",
                disabled
                  ? "cursor-not-allowed text-muted-foreground/35"
                  : "cursor-pointer hover:bg-secondary hover:text-foreground active:scale-95",
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
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  // Nur die vom Nutzer bewusst gewählten Zusatzleistungen. Paket-inklusive
  // Leistungen kommen abgeleitet dazu und verschwinden beim Paketwechsel
  // automatisch wieder – vorher blieben sie kostenpflichtig hängen.
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [pickupCity, setPickupCity] = useState<string>("");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", plate: "" });
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [touched, setTouched] = useState<Partial<Record<CustomerField, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<CustomerField, string>>>({});
  const [submitError, setSubmitError] = useState<BackendErrorInfo | null>(null);
  // Belegte Termine werden erst geladen, wenn der Nutzer in die Nähe des
  // Buchungsbereichs scrollt. Die Preise liefert bereits der Root-Loader.
  const [liveBlockedSlots, setLiveBlockedSlots] = useState<Record<string, string[]>>({});
  const fetchBookedSlots = useServerFn(getBookedSlots);
  useEffect(() => {
    void fetchBookedSlots({})
      .then(setLiveBlockedSlots)
      .catch(() => undefined);
  }, [fetchBookedSlots]);

  function updateCustomer(field: CustomerField, value: string) {
    setCustomer((c) => ({ ...c, [field]: value }));
    // Echtzeit-Validierung: Fehler erst nach erster Interaktion anzeigen,
    // aber sofort wieder entfernen, sobald die Eingabe korrekt ist.
    setErrors((e) => {
      const message = validateCustomerField(field, value);
      if (!message) return { ...e, [field]: undefined };
      return touched[field] ? { ...e, [field]: message } : e;
    });
  }

  function blurCustomer(field: CustomerField) {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validateCustomerField(field, customer[field]) }));
  }

  const includedAddOnIds = useMemo(
    () =>
      packageId
        ? addOns.filter((a) => a.includedInPackages?.includes(packageId)).map((a) => a.id)
        : [],
    [packageId],
  );

  const addOnIds = useMemo(
    () => Array.from(new Set([...selectedAddOnIds, ...includedAddOnIds])),
    [selectedAddOnIds, includedAddOnIds],
  );

  const pickupSelected = !!pickupAddOn && addOnIds.includes(pickupAddOn.id);
  const pickupCityData = pickupCitiesByDistance.find((c) => c.slug === pickupCity);
  const pickupDistanceKm = pickupCityData?.distanceKm ?? null;
  const pickupPrice = pickupDistanceKm === null ? null : getPickupPrice(pickupDistanceKm);
  const pickupIncluded = pickupDistanceKm !== null && isPickupIncluded(packageId, pickupDistanceKm);
  const pickupOnRequest = pickupSelected && !pickupIncluded && pickupPrice === null;
  const pickupTierText = pickupTierSummary();

  const items = useMemo(
    () =>
      vehicleId && packageId
        ? calcLineItems({ vehicleId, packageId, addOnIds, pickupCity: pickupCity || null })
        : [],
    [vehicleId, packageId, addOnIds, pickupCity],
  );
  const totals = calcTotals(items);

  // Schritt "Extras": Ohne gültigen Abholort lässt sich der Staffelpreis nicht bestimmen.
  const pickupStepValid = !pickupSelected || (!!pickupCityData && !pickupOnRequest);

  const canContinue = [
    !!vehicleId,
    !!packageId,
    pickupStepValid,
    !!date && !!time,
    Object.keys(validateCustomer(customer)).length === 0 && pickupStepValid,
  ][step];

  const submitBooking = useServerFn(createBooking);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!vehicleId || !packageId || !date || !time || submitting) return;
    if (!pickupStepValid) {
      setStep(2);
      toast.error("Bitte wählen Sie einen gültigen Abholort für den Hol- & Bringservice.");
      return;
    }
    const fieldErrors = validateCustomer(customer);
    if (Object.keys(fieldErrors).length > 0) {
      setTouched({ name: true, email: true, phone: true, plate: true });
      setErrors(fieldErrors);
      toast.error("Bitte korrigieren Sie die markierten Felder.");
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
          time,
          name: customer.name.trim(),
          email: customer.email.trim(),
          phone: customer.phone.trim(),
          plate: customer.plate.trim().toUpperCase(),
          pickupCity: pickupSelected ? pickupCity : null,
        },
      });
      setConfirmed(booking);
      toast.success("Buchungsanfrage übermittelt – wir bestätigen den Termin in Kürze");
      reportAdsConversion({ value: totals.gross, invoiceNumber: booking.invoiceNumber });
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="glass rounded-3xl p-5 sm:p-8">
          {/* Fortschritt */}
          <ol
            className="mb-8 flex items-center gap-1.5 overflow-x-auto pb-1"
            aria-label={`Buchungsfortschritt: Schritt ${step + 1} von ${steps.length}`}
          >
            {steps.map((s, i) => (
              <li
                key={s}
                className="flex min-w-0 flex-1 items-center gap-1.5"
                aria-current={i === step ? "step" : undefined}
              >
                <span
                  className={[
                    "flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : i < step
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground",
                  ].join(" ")}
                >
                  <span className="tabular-nums opacity-70">{i + 1}</span>
                  <span className="hidden sm:inline">{s}</span>
                  <span className="sr-only">
                    {s}
                    {i === step ? " (aktueller Schritt)" : i < step ? " (abgeschlossen)" : ""}
                  </span>
                </span>
                {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <section>
              <StepHeader
                title="Welches Fahrzeug fahren Sie?"
                text="Die Fahrzeugklasse bestimmt Aufwand und Materialeinsatz."
              />
              <div className="grid gap-4 sm:grid-cols-3">
                {vehicleTypes.map((v) => {
                  const Icon = vehicleIcons[v.id] ?? Car;
                  const active = vehicleId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehicleId(v.id)}
                      aria-pressed={active}
                      className={[
                        "group rounded-2xl border p-5 text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary bg-primary/10 glow-ring"
                          : "border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/60",
                      ].join(" ")}
                    >
                      <Icon
                        className={[
                          "mb-4 size-7 transition-transform duration-300 group-hover:scale-110",
                          active ? "text-primary" : "text-muted-foreground",
                        ].join(" ")}
                      />
                      <p className="display-card">{v.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>
                      <p className="mt-3 text-xs uppercase tracking-widest text-primary">
                        Preis passend zur Fahrzeuggröße
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <StepHeader
                title="Wählen Sie Ihr Paket"
                text="Alle Pakete werden ausschließlich in Handarbeit ausgeführt."
              />
              <div className="grid gap-4 md:grid-cols-3">
                {servicePackages.map((p) => {
                  const factor = vehicleTypes.find((v) => v.id === vehicleId)?.factor ?? 1;
                  const active = packageId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPackageId(p.id)}
                      aria-pressed={active}
                      className={[
                        "relative flex flex-col rounded-2xl border p-5 text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary bg-primary/10 glow-ring"
                          : "border-border bg-secondary/30 hover:border-primary/50",
                      ].join(" ")}
                    >
                      {p.highlight && (
                        <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-primary-foreground">
                          Beliebt
                        </span>
                      )}
                      <p className="display-card">{p.name}</p>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        {p.tagline}
                      </p>
                      <p className="display-price mt-4">
                        {currency(Math.round(p.basePrice * factor))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Endpreis für diese Fahrzeugklasse · {vatNoticeShort()} · {p.duration}
                      </p>
                      <ul className="mt-4 space-y-2 text-sm text-foreground/80">
                        {p.features.map((f) => (
                          <li key={f} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <StepHeader
                title="Zusatzleistungen"
                text="Optional – jederzeit kombinierbar mit Ihrem Paket."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {addOns.map((a) => {
                  const factor = vehicleTypes.find((v) => v.id === vehicleId)?.factor ?? 1;
                  const included = includedAddOnIds.includes(a.id);
                  const active = addOnIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={included}
                      onClick={() =>
                        setSelectedAddOnIds((prev) =>
                          prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                        )
                      }
                      aria-pressed={active}
                      className={[
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/30 hover:border-primary/40",
                        included ? "cursor-default" : "",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-sm text-muted-foreground">{a.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="display-price text-base">
                          {included
                            ? "Inklusive"
                            : a.distanceBased
                              ? pickupPrice === null
                                ? "nach Entfernung"
                                : pickupPrice === 0
                                  ? "Kostenlos"
                                  : `+${currency(pickupPrice)}`
                              : `+${currency(Math.round(a.price * (a.flatPrice ? 1 : factor)))}`}
                        </span>
                        <span
                          className={[
                            "grid size-7 place-items-center rounded-md border transition-colors",
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
              </div>

              {pickupSelected && pickupAddOn && (
                <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                  <Label
                    htmlFor="pickup-city"
                    className="text-xs uppercase tracking-widest text-muted-foreground"
                  >
                    Abholort
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Der Preis für Abholung und Rückgabe richtet sich nach der Entfernung zu unserer
                    Werkstatt: {pickupTierText}.
                  </p>
                  <div className="relative mt-3">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="pickup-city"
                      value={pickupCity}
                      onChange={(e) => setPickupCity(e.target.value)}
                      aria-invalid={!pickupStepValid ? true : undefined}
                      aria-describedby={!pickupStepValid ? "pickup-city-error" : undefined}
                      className="h-11 w-full rounded-md border border-input bg-secondary/40 pl-9 pr-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

                  {pickupCityData && pickupIncluded && (
                    <p className="mt-3 text-sm text-primary">
                      Im Paket {servicePackages.find((p) => p.id === packageId)?.name} ist die
                      Abholung in {pickupCityData.name} kostenfrei enthalten.
                    </p>
                  )}

                  {pickupOnRequest && (
                    <p
                      id="pickup-city-error"
                      role="alert"
                      className="mt-3 text-sm text-destructive"
                    >
                      {pickupCityData?.name} liegt mit {pickupCityData?.distanceKm} km außerhalb
                      unserer festen Preisstaffel. Wir kalkulieren die Abholung dorthin gerne
                      individuell – bitte melden Sie sich unter {company.email} oder wählen Sie
                      einen anderen Abholort.
                    </p>
                  )}

                  {!pickupCityData && (
                    <p
                      id="pickup-city-error"
                      role="alert"
                      className="mt-3 text-sm text-muted-foreground"
                    >
                      Bitte wählen Sie einen Abholort, damit wir den Preis berechnen können.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section>
              <StepHeader
                title="Wunschtermin wählen"
                text="Sonntags geschlossen. Belegte Zeitfenster sind deaktiviert."
              />
              <div className="grid gap-5 md:grid-cols-2">
                <MiniCalendar
                  value={date}
                  onChange={(iso) => {
                    setDate(iso);
                    setTime(null);
                  }}
                />
                <div className="glass rounded-2xl p-5">
                  <p className="label-caps mb-4 flex items-center gap-2 text-muted-foreground">
                    <CalendarIcon className="size-4 text-primary" />
                    Freie Zeitfenster
                  </p>
                  {!date ? (
                    <p className="text-sm text-muted-foreground">
                      Bitte wählen Sie zunächst ein Datum aus.
                    </p>
                  ) : (
                    <div
                      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                      role="group"
                      aria-label="Freie Zeitfenster"
                    >
                      {timeSlots.map((slot) => {
                        const blocked = (liveBlockedSlots[date] ?? []).includes(slot);
                        const active = time === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={blocked}
                            onClick={() => setTime(slot)}
                            aria-pressed={active}
                            aria-label={`${slot} Uhr${blocked ? " – belegt" : ""}`}
                            className={[
                              "min-h-11 rounded-xl border py-2.5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
                              blocked
                                ? "cursor-not-allowed border-border/50 text-muted-foreground/40 line-through"
                                : active
                                  ? "border-primary bg-primary text-primary-foreground glow-ring"
                                  : "cursor-pointer border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/60 active:scale-[0.97]",
                            ].join(" ")}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <StepHeader
                title="Ihre Kontaktdaten"
                text="Wir bestätigen den Termin telefonisch oder per E-Mail."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="name"
                  label="Name"
                  icon={User}
                  value={customer.name}
                  placeholder="Max Mustermann"
                  onChange={(v) => updateCustomer("name", v)}
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
                  onChange={(v) => updateCustomer("email", v)}
                  onBlur={() => blurCustomer("email")}
                  error={errors.email}
                />
                <Field
                  id="phone"
                  label="Telefon"
                  icon={Phone}
                  value={customer.phone}
                  placeholder="+49 176 12345678"
                  onChange={(v) => updateCustomer("phone", v)}
                  onBlur={() => blurCustomer("phone")}
                  error={errors.phone}
                />
                <Field
                  id="plate"
                  label="Kennzeichen"
                  icon={Car}
                  value={customer.plate}
                  placeholder="BN-WG 1967"
                  onChange={(v) => updateCustomer("plate", v)}
                  onBlur={() => blurCustomer("plate")}
                  error={errors.plate}
                />
              </div>
              {submitError && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
                >
                  <p className="font-medium">{submitError.title}</p>
                  <p className="mt-1">{submitError.description}</p>
                  {submitError.missing.length > 0 && (
                    <p className="mt-2 text-xs">
                      Fehlende Konfiguration:{" "}
                      <span className="font-mono">{submitError.missing.join(", ")}</span>
                    </p>
                  )}
                  {submitError.hint && <p className="mt-2 text-xs">{submitError.hint}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Alternativ erreichen Sie uns per E-Mail unter info@whitegloss.de.
                  </p>
                </div>
              )}

              <p className="mt-4 text-xs text-muted-foreground">
                Mit dem Absenden stimmen Sie der Verarbeitung Ihrer Daten zur Terminabwicklung zu.
              </p>
            </section>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
            <Button
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="size-4" />
              Zurück
            </Button>
            {step < steps.length - 1 ? (
              <Button disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
                Weiter
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button disabled={!canContinue} loading={submitting} onClick={submit}>
                {submitting ? "Wird gesendet …" : "Terminanfrage senden"}
                {submitting ? null : <CheckCircle2 className="size-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Live-Preisrechner */}
        <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Live-Preisübersicht">
          <div className="glass-strong rounded-3xl p-6" aria-live="polite">
            <p className="label-caps flex items-center gap-2 text-muted-foreground">
              <Sparkles className="size-4 text-primary" />
              Ihre Konfiguration
            </p>
            <div className="mt-5 space-y-3 text-sm">
              {items.length === 0 && (
                <p className="text-muted-foreground">
                  Wählen Sie Fahrzeug und Paket, um den Preis zu berechnen.
                </p>
              )}
              {items.map((i) => (
                <div key={i.label} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-foreground/80">{i.label}</span>
                  <span className="shrink-0 font-medium tabular-nums">{currency(i.total)}</span>
                </div>
              ))}
            </div>
            {items.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                <div className="flex items-baseline justify-between pt-2">
                  <span className="label-caps">Voraussichtlicher Gesamtpreis</span>
                  <span className="display-price text-primary">{currency(totals.gross)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{vatNotice()}</p>
              </div>
            )}
            {date && time && (
              <p className="mt-5 rounded-xl bg-secondary/50 px-4 py-3 text-sm">
                Termin:{" "}
                <span className="font-medium">
                  {new Date(date).toLocaleDateString("de-DE", { dateStyle: "long" })}, {time} Uhr
                </span>
              </p>
            )}
          </div>
        </aside>
      </div>
      <Toaster position="top-center" richColors />
    </>
  );
}

function StepHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-6">
      <h3 className="display-sub">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
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
  onChange: (v: string) => void;
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
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-11 bg-secondary/40 pl-9 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
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

function Confirmation({ booking, onReset }: { booking: Booking; onReset: () => void }) {
  const items = calcLineItems(booking);
  const totals = calcTotals(items);
  const pickupCityName = booking.pickupCity
    ? (pickupCitiesByDistance.find((c) => c.slug === booking.pickupCity)?.name ?? null)
    : null;

  return (
    <div className="glass-strong mx-auto max-w-2xl rounded-3xl p-6 text-center sm:p-10">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/15 glow-ring">
        <CheckCircle2 className="size-8 text-primary" />
      </div>
      <h3 className="display-sub mt-6">Buchungsanfrage erhalten</h3>
      <p className="mt-2 text-muted-foreground">
        Vielen Dank, {booking.customer.name}. Ihr Wunschtermin ist vorgemerkt. Die verbindliche
        Bestätigung erhalten Sie, sobald unser Team die Buchung freigegeben hat.
      </p>

      <dl className="mt-8 grid gap-3 rounded-2xl bg-secondary/40 p-5 text-left text-sm">
        <Detail label="Anfragenummer" value={booking.invoiceNumber} />
        <Detail
          label="Leistungsdatum"
          value={`${new Date(booking.date).toLocaleDateString("de-DE", { dateStyle: "long" })}, ${booking.time} Uhr`}
        />
        <Detail label="Kennzeichen" value={booking.customer.plate} />
        {pickupCityName && <Detail label="Abholort" value={pickupCityName} />}
        {items.map((i) => (
          <Detail key={i.label} label={i.label} value={currency(i.total)} />
        ))}
        <div className="mt-2 flex justify-between border-t border-border pt-3 display-card">
          <span>Gesamt</span>
          <span className="text-primary">{currency(totals.gross)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{vatNotice()}</p>
        {booking.depositAmount > 0 && (
          <div className="flex justify-between text-sm text-amber-300">
            <span>{depositConfig.label}</span>
            <span className="font-semibold">{currency(booking.depositAmount)}</span>
          </div>
        )}
      </dl>

      {booking.depositAmount > 0 && (
        <p className="mx-auto mt-4 max-w-lg rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-left text-sm text-amber-200">
          {depositConfig.note} Ihre Anzahlung von <strong>{currency(booking.depositAmount)}</strong>{" "}
          sichert den Termin – die Zahlungsinformationen erhalten Sie mit der Bestätigung per
          E-Mail.
        </p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <p className="w-full text-sm text-muted-foreground">
          Die verbindliche Bestätigung und Rechnung erhalten Sie nach Prüfung Ihrer Anfrage.
        </p>
        <Button variant="outline" onClick={onReset}>
          Neue Buchung
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="shrink-0 font-medium">{value}</dd>
    </div>
  );
}
