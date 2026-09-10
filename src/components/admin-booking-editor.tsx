import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  cities,
  extras,
  packages,
  timeSlots,
  vehicleClasses,
  quoteTotal,
  type PackageId,
  type VehicleClass,
} from "@/data/site";
import type { BookingRow } from "@/lib/bookings.functions";
import { Button, Field, inputClass } from "./ui";
import { eur } from "@/lib/utils";

export type BookingEditValues = {
  id: number;
  expectedVersion: number;
  name: string;
  phone: string;
  email: string;
  date: string;
  slot: string;
  packageId: PackageId;
  classId: VehicleClass["id"];
  extraIds: string[];
  citySlug: string;
  note: string;
  notifyCustomer?: boolean;
};

function selectedExtras(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function AdminBookingEditor({
  row,
  pending,
  onSave,
  onCancel,
}: {
  row?: BookingRow;
  pending: boolean;
  onSave: (values: BookingEditValues) => Promise<void>;
  onCancel: () => void;
}) {
  const nameInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<BookingEditValues>(() => ({
    id: row?.id ?? 0,
    expectedVersion: row?.version ?? 1,
    name: row?.customer_name ?? "",
    phone: row?.phone ?? "",
    email: row?.email ?? "",
    date: row?.preferred_date?.slice(0, 10) ?? "",
    slot: row?.preferred_slot ?? "",
    packageId: (row?.package_id as PackageId) ?? "basis",
    classId: (row?.class_id as VehicleClass["id"]) ?? "kompakt",
    extraIds: selectedExtras(row?.extra_ids ?? "[]"),
    citySlug: row?.city_slug ?? "",
    note: row?.note ?? "",
    notifyCustomer: false,
  }));
  useEffect(() => {
    nameInput.current?.focus();
  }, []);

  function update<Key extends keyof BookingEditValues>(key: Key, value: BookingEditValues[Key]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) await onSave(values);
  }

  const prefix = row ? `booking-${row.id}` : "booking-new";
  const knownPackage = packages.some((pack) => pack.id === values.packageId);
  const knownClass = vehicleClasses.some((item) => item.id === values.classId);
  const quote = knownPackage && knownClass ? quoteTotal(values) : null;
  return (
    <form
      className="mt-5 space-y-4 border-t border-line pt-5"
      onSubmit={submit}
      aria-labelledby={`${prefix}-edit`}
    >
      <h3 id={`${prefix}-edit`} className="font-display text-2xl">
        {row ? "Anfrage bearbeiten" : "Buchung manuell hinzufügen"}
      </h3>
      {row?.status === "bestaetigt" ? (
        <p className="text-sm text-muted">
          Änderungen an Datum, Abgabezeit oder Leistung setzen den Termin zurück auf „Wartet auf
          Bestätigung“. Die erneute Freigabe erfolgt anschließend separat.
        </p>
      ) : null}
      {!row ? (
        <p className="text-sm text-muted">
          Für Telefon- oder Vor-Ort-Anfragen. Der Termin wartet nach dem Speichern auf deine
          Bestätigung und wird nach Odoo übertragen.
        </p>
      ) : null}
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Kunden- und Termindaten</legend>
        <Field id={`${prefix}-name`} label="Name">
          <input
            ref={nameInput}
            id={`${prefix}-name`}
            className={inputClass}
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            minLength={2}
            maxLength={120}
            required
          />
        </Field>
        <Field id={`${prefix}-phone`} label="Telefon">
          <input
            id={`${prefix}-phone`}
            type="tel"
            className={inputClass}
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            minLength={6}
            maxLength={40}
            required
          />
        </Field>
        <Field id={`${prefix}-email`} label="E-Mail (optional)">
          <input
            id={`${prefix}-email`}
            type="email"
            className={inputClass}
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            maxLength={160}
          />
        </Field>
        <Field id={`${prefix}-date`} label="Wunschdatum (optional)">
          <input
            id={`${prefix}-date`}
            type="date"
            className={inputClass}
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
          />
        </Field>
        <Field id={`${prefix}-slot`} label="Abgabezeit (optional)">
          <select
            id={`${prefix}-slot`}
            className={inputClass}
            value={values.slot}
            onChange={(e) => update("slot", e.target.value)}
          >
            <option value="">Keine Angabe</option>
            {timeSlots.map((slot) => (
              <option key={slot}>{slot}</option>
            ))}
          </select>
        </Field>
        <Field id={`${prefix}-package`} label="Leistung">
          <select
            id={`${prefix}-package`}
            className={inputClass}
            value={values.packageId}
            onChange={(e) => update("packageId", e.target.value as PackageId)}
          >
            {!knownPackage ? (
              <option value={values.packageId} disabled>
                Bitte aktuelle Leistung auswählen
              </option>
            ) : null}
            {packages.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${prefix}-class`} label="Fahrzeugklasse">
          <select
            id={`${prefix}-class`}
            className={inputClass}
            value={values.classId}
            onChange={(e) => update("classId", e.target.value as VehicleClass["id"])}
          >
            {!knownClass ? (
              <option value={values.classId} disabled>
                Bitte Fahrzeugklasse auswählen
              </option>
            ) : null}
            {vehicleClasses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${prefix}-city`} label="Abholort">
          <select
            id={`${prefix}-city`}
            className={inputClass}
            value={values.citySlug}
            onChange={(e) => update("citySlug", e.target.value)}
          >
            <option value="">Keine Abholung</option>
            {cities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Extras</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {extras.map((extra) => (
              <label key={extra.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.extraIds.includes(extra.id)}
                  onChange={(e) =>
                    update(
                      "extraIds",
                      e.target.checked
                        ? [...values.extraIds, extra.id]
                        : values.extraIds.filter((id) => id !== extra.id),
                    )
                  }
                />
                {extra.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Field
            id={`${prefix}-note`}
            label="Fahrzeug, Kennzeichen und weitere Hinweise (optional)"
          >
            <textarea
              id={`${prefix}-note`}
              className={`${inputClass} min-h-24 py-2`}
              value={values.note}
              onChange={(e) => update("note", e.target.value)}
              maxLength={2000}
            />
          </Field>
        </div>
        {!row ? (
          <label className="inline-flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={values.notifyCustomer}
              disabled={!values.email.trim()}
              onChange={(e) => update("notifyCustomer", e.target.checked)}
            />
            Buchungsanfrage mit PDF per E-Mail an den Kunden senden
          </label>
        ) : null}
      </fieldset>
      {quote ? (
        <p className="text-sm">
          Preis laut Leistungsauswahl: <strong>{eur(quote.total)}</strong>
          {quote.pickupOnRequest ? " · Abholung auf Anfrage, noch nicht enthalten" : ""}
        </p>
      ) : (
        <p role="status" className="text-sm text-muted">
          Diese ältere Buchung enthält eine unbekannte Leistung oder Fahrzeugklasse. Bitte wähle die
          passenden aktuellen Angaben aus.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !quote} aria-busy={pending}>
          {pending ? "Wird gespeichert …" : row ? "Änderungen speichern" : "Buchung anlegen"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
