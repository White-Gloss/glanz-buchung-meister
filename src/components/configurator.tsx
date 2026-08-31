import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { createPublicBooking } from "@/lib/bookings.functions";
import { eur } from "@/lib/utils";
import { Button, Field, inputClass } from "./ui";

export function Configurator({
  initialPackage = "premium",
}: {
  initialPackage?: PackageId;
}) {
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
  const [privacy, setPrivacy] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const quote = useMemo(
    () => quoteTotal({ packageId, classId, extraIds, citySlug }),
    [packageId, classId, extraIds, citySlug],
  );

  function toggleExtra(id: string) {
    setExtraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !phone.trim()) {
      setError("Bitte Name und Telefon angeben.");
      return;
    }
    if (!privacy) {
      setError("Bitte die Datenschutzerklärung bestätigen.");
      return;
    }
    setPending(true);
    try {
      await createPublicBooking({
        data: {
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
          kind: "booking",
          privacy: true as const,
          website,
        },
      });
      await navigate({ to: "/danke" });
    } catch {
      setError("Senden fehlgeschlagen. Bitte telefonisch oder per WhatsApp erreichen.");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
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
                className={`lift flex cursor-pointer items-start gap-3 rounded-md border p-4 ${
                  packageId === p.id ? "border-accent bg-elevated" : "border-line bg-surface"
                }`}
              >
                <input
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
                  <span className="mt-1 block text-xs leading-relaxed text-subtle">
                    {p.kicker}
                  </span>
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
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${
                  classId === c.id ? "border-accent bg-elevated" : "border-line bg-surface"
                }`}
              >
                <input
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
          <legend className="text-xs uppercase tracking-[0.16em] text-subtle">Extras</legend>
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
                      className="flex items-start justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3"
                    >
                      <span className="flex min-w-0 items-start">
                        <input
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

        <Field id="city" label="Abholort">
          <select
            id="city"
            className={inputClass}
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

      <div className="ga-quote h-fit space-y-5 rounded-lg border border-line bg-elevated p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Unverbindliche Anfrage</p>
        <p className="font-display text-3xl text-fg" aria-live="polite">
          {eur(quote.total)}
        </p>
        <p className="text-sm text-muted">
          {quote.klass.label} · {quote.pack.name}
          {quote.city ? ` · Abholung ${pickupPriceText(quote.city.km, packageId)}` : quote.pickupOnRequest ? " · Abholung auf Anfrage" : ""}
        </p>
        <p className="text-xs text-subtle">
          Das ist der Startpreis inkl. MwSt. Wenn der Zustand mehr Aufwand braucht,
          stimmen wir den Endpreis nach dem Anschauen mit Ihnen ab.{" "}
          {depositConfig.label}: {depositConfig.note}
        </p>
        <Field id="name" label="Name">
          <input
            id="name"
            className={inputClass}
            autoComplete="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field id="phone" label="Telefon">
          <input
            id="phone"
            className={inputClass}
            autoComplete="tel"
            inputMode="tel"
            type="tel"
            name="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field id="email" label="E-Mail (optional)">
          <input
            id="email"
            type="email"
            className={inputClass}
            autoComplete="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="date" label="Wunschtermin (optional)">
          <input
            id="date"
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field id="slot" label="Zeitfenster (optional)">
          <select
            id="slot"
            className={inputClass}
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
          >
            <option value="">Keine Angabe</option>
            {timeSlots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field id="note" label="Hinweis">
          <textarea
            id="note"
            className={`${inputClass} min-h-24 py-2`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <label htmlFor="privacy" className="flex items-start gap-2 text-sm text-muted">
          <input
            id="privacy"
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
            zur Kenntnis genommen. Die Anfrage ist unverbindlich.
          </span>
        </label>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
          {pending ? "Wird gesendet …" : "Terminanfrage senden"}
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
