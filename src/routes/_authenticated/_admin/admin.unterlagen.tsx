import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  Pencil,
  Printer,
  ReceiptText,
  Save,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupabaseConfigNotice } from "@/components/SupabaseConfigNotice";
import { diagnoseBackendError } from "@/lib/backendErrors";
import {
  contactChannels,
  currency,
  type Booking,
  type BookingSource,
  type ContactChannel,
} from "@/lib/bookings";
import {
  createManualBooking,
  listBookings,
  updateBookingAgreedPrice,
  updateBookingStatus,
} from "@/lib/bookings.functions";
import { downloadBookingDocumentPdf, printBookingDocumentPdf } from "@/lib/bookingDocument";
import {
  bookingDocumentDraftStorageKey,
  createBookingDocumentDraft,
  mergeBookingDocumentDraft,
  type BookingDocumentDraft,
} from "@/lib/bookingDocumentDraft";
import { addOns, servicePackages, vehicleTypes } from "@/lib/servicesConfig";
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";

export const Route = createFileRoute("/_authenticated/_admin/admin/unterlagen")({
  head: () => ({
    meta: [
      { title: "Unterlagen & Preis – White Gloss Detailing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DocumentsRoute,
  errorComponent: ({ error }) => <SupabaseConfigNotice info={diagnoseBackendError(error)} />,
});

function DocumentsRoute() {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return <SupabaseConfigNotice missing={config.missing} />;
  return <DocumentsPage />;
}

const sourceLabels: Record<BookingSource, string> = {
  website: "Website",
  whatsapp: "WhatsApp",
  telefon: "Telefon",
  vor_ort: "Vor Ort",
  sonstiges: "Sonstiges",
};

const manualSources: BookingSource[] = ["whatsapp", "telefon", "vor_ort", "sonstiges"];
const manualAddOns = addOns.filter((item) => !item.distanceBased);

function DocumentsPage() {
  const listFn = useServerFn(listBookings);
  const createFn = useServerFn(createManualBooking);
  const priceFn = useServerFn(updateBookingAgreedPrice);
  const statusFn = useServerFn(updateBookingStatus);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [showManual, setShowManual] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [documentDrafts, setDocumentDrafts] = useState<Record<string, BookingDocumentDraft>>({});
  const [manual, setManual] = useState({
    source: "whatsapp" as BookingSource,
    name: "",
    email: "",
    phone: "",
    plate: "",
    vehicleId: vehicleTypes[0]?.id ?? "",
    packageId: servicePackages[0]?.id ?? "",
    addOnIds: [] as string[],
    date: "",
    preferredContact: "Telefon" as ContactChannel,
  });

  async function reload() {
    const rows = await listFn();
    setBookings(rows);
    setPrices(
      Object.fromEntries(
        rows.map((booking) => [
          booking.id,
          booking.agreedPrice != null ? String(booking.agreedPrice) : "",
        ]),
      ),
    );
  }

  useEffect(() => {
    let active = true;
    listFn()
      .then((rows) => {
        if (!active) return;
        setBookings(rows);
        setPrices(
          Object.fromEntries(
            rows.map((booking) => [
              booking.id,
              booking.agreedPrice != null ? String(booking.agreedPrice) : "",
            ]),
          ),
        );
      })
      .catch((error) => toast.error(diagnoseBackendError(error).description))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [listFn]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bookings;
    return bookings.filter((booking) =>
      [
        booking.invoiceNumber,
        booking.customer.name,
        booking.customer.email,
        booking.customer.phone,
        booking.customer.plate,
        sourceLabels[booking.bookingSource ?? "website"],
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [bookings, query]);

  async function savePrice(booking: Booking) {
    const agreedPrice = Number(String(prices[booking.id] ?? "").replace(",", "."));
    setBusyId(booking.id);
    try {
      const updated = await priceFn({ data: { id: booking.id, agreedPrice } });
      setBookings((rows) => rows.map((item) => (item.id === booking.id ? updated : item)));
      setPrices((values) => ({ ...values, [booking.id]: String(updated.agreedPrice ?? "") }));
      toast.success("Vereinbarter Preis gespeichert");
    } catch (error) {
      toast.error(diagnoseBackendError(error).description);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmBooking(booking: Booking) {
    setBusyId(booking.id);
    try {
      const updated = await statusFn({ data: { id: booking.id, status: "Bestätigt" } });
      setBookings((rows) => rows.map((item) => (item.id === booking.id ? updated : item)));
      toast.success("Termin bestätigt – Bestätigungsmail wurde ausgelöst");
    } catch (error) {
      toast.error(diagnoseBackendError(error).description);
    } finally {
      setBusyId(null);
    }
  }

  async function createManual() {
    setCreating(true);
    try {
      await createFn({
        data: {
          source: manual.source,
          name: manual.name,
          email: manual.email,
          phone: manual.phone,
          plate: manual.plate,
          vehicleId: manual.vehicleId,
          packageId: manual.packageId,
          addOnIds: manual.addOnIds,
          date: manual.date,
          pickupCity: null,
          preferredContact: manual.preferredContact,
        },
      });
      toast.success("Manuelle Buchung angelegt");
      setManual((value) => ({
        ...value,
        name: "",
        email: "",
        phone: "",
        plate: "",
        addOnIds: [],
        date: "",
        preferredContact: "Telefon" as ContactChannel,
      }));
      setShowManual(false);
      await reload();
    } catch (error) {
      toast.error(diagnoseBackendError(error).description);
    } finally {
      setCreating(false);
    }
  }

  function openDocumentEditor(booking: Booking) {
    let draft = documentDrafts[booking.id];
    if (!draft && typeof window !== "undefined") {
      const saved = window.localStorage.getItem(bookingDocumentDraftStorageKey(booking.id));
      if (saved) {
        try {
          draft = { ...createBookingDocumentDraft(booking), ...JSON.parse(saved) };
        } catch {
          window.localStorage.removeItem(bookingDocumentDraftStorageKey(booking.id));
        }
      }
    }
    setDocumentDrafts((current) => ({
      ...current,
      [booking.id]: draft ?? createBookingDocumentDraft(booking),
    }));
    setEditingId(booking.id);
  }

  function updateDocumentDraft(booking: Booking, field: keyof BookingDocumentDraft, value: string) {
    setDocumentDrafts((current) => ({
      ...current,
      [booking.id]: {
        ...(current[booking.id] ?? createBookingDocumentDraft(booking)),
        [field]: value,
      },
    }));
  }

  function saveDocumentDraft(booking: Booking) {
    const draft = documentDrafts[booking.id] ?? createBookingDocumentDraft(booking);
    window.localStorage.setItem(bookingDocumentDraftStorageKey(booking.id), JSON.stringify(draft));
    toast.success("Dokumententwurf auf diesem Gerät gespeichert");
  }

  function documentBooking(booking: Booking) {
    const draft = documentDrafts[booking.id];
    return draft ? mergeBookingDocumentDraft(booking, draft) : booking;
  }

  return (
    <main id="main-content" className="min-h-dvh bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
              <Link to="/admin">
                <ArrowLeft className="size-4" /> Zurück zum Admin
              </Link>
            </Button>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">White Gloss Admin</p>
            <h1 className="display-sub mt-2 text-3xl sm:text-4xl">Unterlagen & Preis</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Preise festhalten, Buchungen aus WhatsApp/Telefon/vor Ort erfassen und PDFs im
              White-Gloss-Briefbogen erstellen. Fehlende Kunden-, Bank- und Steuerdaten werden in
              Entwürfen sichtbar als „wird nachgereicht“ markiert.
            </p>
          </div>
          <Button onClick={() => setShowManual((value) => !value)}>
            <FilePlus2 className="size-4" /> Buchung manuell erfassen
          </Button>
        </div>

        {showManual && (
          <section className="glass mt-6 rounded-3xl p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="display-card text-lg">Neue manuelle Buchung</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Für Anfragen über WhatsApp, Telefon oder direkt vor Ort. Die automatische
                Kunden-Eingangsmail wird bei manueller Erfassung nicht verschickt.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Quelle">
                <select
                  value={manual.source}
                  onChange={(event) =>
                    setManual((value) => ({
                      ...value,
                      source: event.target.value as BookingSource,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {manualSources.map((source) => (
                    <option key={source} value={source}>
                      {sourceLabels[source]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name">
                <Input
                  value={manual.name}
                  onChange={(event) =>
                    setManual((value) => ({ ...value, name: event.target.value }))
                  }
                />
              </Field>
              <Field label="E-Mail">
                <Input
                  type="email"
                  value={manual.email}
                  onChange={(event) =>
                    setManual((value) => ({ ...value, email: event.target.value }))
                  }
                />
              </Field>
              <Field label="Telefon">
                <Input
                  value={manual.phone}
                  onChange={(event) =>
                    setManual((value) => ({ ...value, phone: event.target.value }))
                  }
                />
              </Field>
              <Field label="Kennzeichen">
                <Input
                  value={manual.plate}
                  onChange={(event) =>
                    setManual((value) => ({ ...value, plate: event.target.value }))
                  }
                />
              </Field>
              <Field label="Fahrzeugklasse">
                <select
                  value={manual.vehicleId}
                  onChange={(event) =>
                    setManual((value) => ({ ...value, vehicleId: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {vehicleTypes.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Leistungspaket">
                <select
                  value={manual.packageId}
                  onChange={(event) =>
                    setManual((value) => ({ ...value, packageId: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  {servicePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Datum">
                <Input
                  type="date"
                  value={manual.date}
                  onChange={(event) =>
                    setManual((value) => ({ ...value, date: event.target.value }))
                  }
                />
              </Field>
              <Field label="Bevorzugter Kontakt">
                <select
                  value={manual.preferredContact}
                  onChange={(event) =>
                    setManual((value) => ({
                      ...value,
                      preferredContact: event.target.value as ContactChannel,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm"
                >
                  {contactChannels.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {manualAddOns.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium">Zusatzleistungen</p>
                <div className="flex flex-wrap gap-2">
                  {manualAddOns.map((addOn) => {
                    const checked = manual.addOnIds.includes(addOn.id);
                    return (
                      <label
                        key={addOn.id}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setManual((value) => ({
                              ...value,
                              addOnIds: checked
                                ? value.addOnIds.filter((id) => id !== addOn.id)
                                : [...value.addOnIds, addOn.id],
                            }))
                          }
                        />
                        {addOn.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowManual(false)}>
                Abbrechen
              </Button>
              <Button loading={creating} onClick={createManual}>
                <Send className="size-4" /> Speichern
              </Button>
            </div>
          </section>
        )}

        <div className="mt-8 max-w-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, Kennzeichen, Buchungsnummer …"
              className="pl-9"
            />
          </div>
        </div>

        <section className="mt-5 space-y-4">
          {loading ? (
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
              Buchungen werden geladen …
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
              Keine Buchungen gefunden.
            </div>
          ) : (
            filtered.map((booking) => {
              const pkg = servicePackages.find((item) => item.id === booking.packageId);
              const vehicle = vehicleTypes.find((item) => item.id === booking.vehicleId);
              const source = booking.bookingSource ?? "website";
              const confirmed = booking.status === "Bestätigt";
              const hasPrice = booking.agreedPrice != null;
              return (
                <article key={booking.id} className="glass rounded-2xl p-5">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="display-card text-base">{booking.customer.name}</h2>
                        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                          {sourceLabels[source]}
                        </span>
                        <span className="rounded-full border border-border px-2.5 py-1 text-xs">
                          {booking.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {booking.invoiceNumber} · {booking.customer.plate} ·{" "}
                        {booking.customer.phone}
                      </p>
                      <p className="mt-1 text-sm text-foreground/80">
                        {pkg?.name ?? booking.packageId} · {vehicle?.name ?? booking.vehicleId} ·{" "}
                        {new Date(`${booking.date}T12:00:00`).toLocaleDateString("de-DE")}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Kalkulation: {currency(booking.total)}
                        {hasPrice
                          ? ` · Vereinbart: ${currency(booking.agreedPrice ?? 0)}`
                          : " · Vereinbarter Preis noch offen"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-2 xl:justify-end">
                      <label className="grid gap-1 text-xs text-muted-foreground">
                        Vereinbarter Preis
                        <div className="flex items-center gap-2">
                          <Input
                            inputMode="decimal"
                            value={prices[booking.id] ?? ""}
                            onChange={(event) =>
                              setPrices((values) => ({
                                ...values,
                                [booking.id]: event.target.value,
                              }))
                            }
                            className="w-28"
                            placeholder="0,00"
                          />
                          <span>EUR</span>
                        </div>
                      </label>
                      <Button
                        variant="outline"
                        loading={busyId === booking.id}
                        onClick={() => savePrice(booking)}
                      >
                        Preis speichern
                      </Button>
                      <Button variant="outline" onClick={() => openDocumentEditor(booking)}>
                        <Pencil className="size-4" /> Dokument bearbeiten
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          downloadBookingDocumentPdf(documentBooking(booking), "admin").catch(
                            (error) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "PDF konnte nicht erstellt werden",
                              ),
                          )
                        }
                      >
                        <Download className="size-4" /> Auftrags-PDF
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          downloadBookingDocumentPdf(documentBooking(booking), "offer").catch(
                            (error) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Angebot konnte nicht erstellt werden",
                              ),
                          )
                        }
                      >
                        <FileText className="size-4" /> Angebot
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          downloadBookingDocumentPdf(
                            documentBooking(booking),
                            "invoice-draft",
                          ).catch((error) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Rechnungsentwurf konnte nicht erstellt werden",
                            ),
                          )
                        }
                      >
                        <ReceiptText className="size-4" /> Rechnung (Entwurf)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          downloadBookingDocumentPdf(
                            documentBooking(booking),
                            "payment-reminder-draft",
                          ).catch((error) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Zahlungserinnerung konnte nicht erstellt werden",
                            ),
                          )
                        }
                      >
                        <BellRing className="size-4" /> Zahlungserinnerung
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          printBookingDocumentPdf(documentBooking(booking)).catch((error) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Druckansicht konnte nicht geöffnet werden",
                            ),
                          )
                        }
                      >
                        <Printer className="size-4" /> Drucken
                      </Button>
                      {!confirmed && booking.status !== "Storniert" && (
                        <Button
                          disabled={!hasPrice || busyId === booking.id}
                          loading={busyId === booking.id}
                          title={
                            hasPrice
                              ? "Termin verbindlich bestätigen"
                              : "Zuerst vereinbarten Preis speichern"
                          }
                          onClick={() => confirmBooking(booking)}
                        >
                          <CheckCircle2 className="size-4" /> Bestätigen
                        </Button>
                      )}
                    </div>
                  </div>
                  {editingId === booking.id && (
                    <DocumentEditor
                      booking={booking}
                      draft={documentDrafts[booking.id] ?? createBookingDocumentDraft(booking)}
                      onChange={(field, value) => updateDocumentDraft(booking, field, value)}
                      onSave={() => saveDocumentDraft(booking)}
                      onClose={() => setEditingId(null)}
                    />
                  )}
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function DocumentEditor({
  booking,
  draft,
  onChange,
  onSave,
  onClose,
}: {
  booking: Booking;
  draft: BookingDocumentDraft;
  onChange: (field: keyof BookingDocumentDraft, value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const fields: Array<{
    key: keyof BookingDocumentDraft;
    label: string;
    type?: string;
    placeholder?: string;
  }> = [
    {
      key: "documentNumber",
      label: "Eigene Dokumentnummer",
      placeholder: "optional – Standardnummer bleibt erhalten",
    },
    { key: "customerName", label: "Kundenname" },
    { key: "customerCompany", label: "Firma / Ansprechpartner", placeholder: "optional" },
    { key: "customerStreet", label: "Straße / Hausnummer", placeholder: "für Rechnungsanschrift" },
    { key: "customerCity", label: "PLZ / Ort", placeholder: "für Rechnungsanschrift" },
    { key: "customerEmail", label: "E-Mail", type: "email" },
    { key: "customerPhone", label: "Telefon" },
    { key: "customerPlate", label: "Kennzeichen" },
    { key: "serviceDate", label: "Leistungsdatum", type: "date" },
    { key: "agreedPrice", label: "Dokumentbetrag in EUR" },
    { key: "validUntil", label: "Angebot gültig bis", type: "date" },
    { key: "dueDate", label: "Zahlbar bis", type: "date" },
  ];

  return (
    <section
      className="mt-5 border-t border-border pt-5"
      aria-label={`Dokument für ${booking.invoiceNumber} bearbeiten`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="display-card">Dokumentangaben bearbeiten</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Die Änderungen gelten für die PDF-Schaltflächen dieser Buchung und verändern nicht die
            ursprüngliche Kundenakte.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Dokumenteditor schließen">
          <X className="size-4" /> Schließen
        </Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <Field key={field.key} label={field.label}>
            <Input
              type={field.type ?? "text"}
              value={draft[field.key]}
              placeholder={field.placeholder}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          </Field>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={onSave}>
          <Save className="size-4" /> Entwurf speichern
        </Button>
        <p className="text-xs text-muted-foreground">
          Speicherung lokal auf diesem Gerät. PDF danach über Angebot, Rechnung oder
          Zahlungserinnerung erzeugen.
        </p>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
