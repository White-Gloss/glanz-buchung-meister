import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Camera,
  CheckCircle2,
  Download,
  Mail,
  Phone,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  bookingStatuses,
  currency,
  effectivePrice,
  MAX_BOOKINGS_PER_DAY,
  type Booking,
  type BookingStatus,
} from "@/lib/bookings";
import { servicePackages, vehicleTypes } from "@/lib/servicesConfig";

const statusStyles: Record<BookingStatus, string> = {
  "Wartend auf Prüfung": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "Gegenangebot gesendet": "bg-violet-500/15 text-violet-300 border-violet-500/30",
  Bestätigt: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Ausstehend: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Bezahlt: "bg-primary/15 text-primary border-primary/40",
  Storniert: "bg-destructive/15 text-destructive border-destructive/40",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { dateStyle: "long" });
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Lightbox                                                            */
/* ------------------------------------------------------------------ */

/**
 * Großansicht der Zustandsfotos.
 *
 * Bewusst ohne Bibliothek: ein Overlay, Pfeiltasten, Escape. Mehr braucht
 * es nicht, um Lack, Verschmutzung und Kratzer zu beurteilen — und es
 * kostet keine zusätzlichen Kilobytes im Auslieferungspaket.
 */
function Lightbox({
  urls,
  index,
  onClose,
  onNavigate,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onNavigate((index + 1) % urls.length);
      if (event.key === "ArrowLeft") onNavigate((index - 1 + urls.length) % urls.length);
    }
    document.addEventListener("keydown", onKey);
    // Hintergrund darf nicht mitscrollen, solange das Bild offen ist.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [index, urls.length, onClose, onNavigate]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${index + 1} von ${urls.length}`}
      className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={urls[index]}
        alt={`Fahrzeugzustand, Foto ${index + 1} von ${urls.length}`}
        className="max-h-[85vh] max-w-full rounded-lg object-contain"
        onClick={(event) => event.stopPropagation()}
      />
      <div className="mt-4 flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
        {urls.length > 1 && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate((index - 1 + urls.length) % urls.length)}
            >
              Zurück
            </Button>
            <span className="text-sm text-white/70">
              {index + 1} / {urls.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate((index + 1) % urls.length)}
            >
              Weiter
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={onClose} aria-label="Großansicht schließen">
          <X className="size-4" />
          Schließen
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gegenangebot                                                        */
/* ------------------------------------------------------------------ */

function CounterOfferForm({
  booking,
  dayLoad,
  busy,
  onSubmit,
  onCancel,
}: {
  booking: Booking;
  dayLoad: Record<string, number>;
  busy: boolean;
  onSubmit: (price: number | null, note: string, altDates: string[]) => void;
  onCancel: () => void;
}) {
  const [price, setPrice] = useState(String(effectivePrice(booking)));
  const [note, setNote] = useState(booking.offerNote ?? "");
  const [altDates, setAltDates] = useState<string[]>([
    booking.offerAltDates[0] ?? "",
    booking.offerAltDates[1] ?? "",
    booking.offerAltDates[2] ?? "",
  ]);

  const heute = toISO(new Date());

  // Ein Ersatztermin an einem ausgebuchten Tag wäre eine Zusage, die die
  // Datenbank später ablehnt — deshalb hier schon abfangen.
  const vollerTag = (iso: string) => !!iso && (dayLoad[iso] ?? 0) >= MAX_BOOKINGS_PER_DAY;
  const belegteAuswahl = altDates.filter(vollerTag);

  const preisZahl = price.trim() === "" ? null : Number(price.replace(",", "."));
  const preisUngueltig = preisZahl !== null && (Number.isNaN(preisZahl) || preisZahl <= 0);
  const absendbar =
    note.trim().length >= 5 && !preisUngueltig && belegteAuswahl.length === 0 && !busy;

  return (
    <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/[0.04] p-5">
      <h4 className="display-card uppercase">Gegenangebot erstellen</h4>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Der Kunde erhält Preis, Begründung und bis zu drei Termine zur Auswahl. Verbindlich wird der
        Termin erst mit seiner Zusage.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`preis-${booking.id}`}>Angebotspreis (€)</Label>
          <Input
            id={`preis-${booking.id}`}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            aria-describedby={`preis-hilfe-${booking.id}`}
            className="mt-1.5 h-11 bg-secondary/40"
          />
          <p id={`preis-hilfe-${booking.id}`} className="mt-1.5 text-xs text-muted-foreground">
            Berechnet waren {currency(booking.total)}. Leer lassen übernimmt diesen Wert.
          </p>
          {preisUngueltig && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              Bitte einen Betrag größer als 0 angeben.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor={`grund-${booking.id}`}>Begründung für den Kunden</Label>
          <Textarea
            id={`grund-${booking.id}`}
            value={note}
            maxLength={1000}
            rows={3}
            placeholder="z. B. Laut Fotos deutliche Kratzer auf der Motorhaube – dafür ist eine zweite Polierstufe nötig."
            onChange={(event) => setNote(event.target.value)}
            className="mt-1.5 bg-secondary/40"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Steht so in der E-Mail. Mindestens 5 Zeichen.
          </p>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="label-caps mb-1 text-muted-foreground">
          Ersatztermine (optional, bis zu drei)
        </legend>
        <p className="mb-3 text-xs text-muted-foreground">
          Nur Tage wählbar, an denen noch ein Platz frei ist. Der Wunschtermin{" "}
          {formatDate(booking.date)} steht dem Kunden ohnehin zur Auswahl.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {altDates.map((value, index) => (
            <div key={index}>
              <Label htmlFor={`alt-${booking.id}-${index}`} className="text-xs">
                Ersatztermin {index + 1}
              </Label>
              <Input
                id={`alt-${booking.id}-${index}`}
                type="date"
                min={heute}
                value={value}
                onChange={(event) =>
                  setAltDates((list) =>
                    list.map((entry, i) => (i === index ? event.target.value : entry)),
                  )
                }
                className="mt-1.5 h-11 bg-secondary/40"
              />
              {vollerTag(value) && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  Ausgebucht
                </p>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          disabled={!absendbar}
          loading={busy}
          onClick={() =>
            onSubmit(
              price.trim() === "" ? null : Number(price.replace(",", ".")),
              note.trim(),
              altDates.filter(Boolean),
            )
          }
        >
          Angebot senden
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Karte                                                               */
/* ------------------------------------------------------------------ */

export type BookingCardActions = {
  onStatus: (id: string, status: BookingStatus) => void;
  onConfirm: (id: string) => void;
  onCounterOffer: (id: string, price: number | null, note: string, altDates: string[]) => void;
  onDepositPaid: (id: string) => void;
  onDelete: (id: string) => void;
  onInvoice: (booking: Booking) => void;
  /** Lädt die signierten Foto-Adressen erst beim Aufklappen. */
  onLoadPhotos: (bookingId: string) => Promise<string[]>;
};

export function BookingCard({
  booking,
  dayLoad,
  photoCount,
  invoiceBusy,
  actions,
  legalDetailsVerified,
}: {
  booking: Booking;
  dayLoad: Record<string, number>;
  /** Anzahl vorhandener Zustandsfotos, aus der Meldungsliste. */
  photoCount: number;
  invoiceBusy: boolean;
  actions: BookingCardActions;
  legalDetailsVerified: boolean;
}) {
  const [showOffer, setShowOffer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const vehicle = vehicleTypes.find((v) => v.id === booking.vehicleId);
  const pkg = servicePackages.find((p) => p.id === booking.packageId);
  const preis = effectivePrice(booking);
  const belegt = dayLoad[booking.date] ?? 0;

  const eingang = useMemo(
    () =>
      new Date(booking.createdAt).toLocaleString("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [booking.createdAt],
  );

  async function togglePhotos() {
    if (photos) {
      setPhotos(null);
      return;
    }
    setLoadingPhotos(true);
    try {
      setPhotos(await actions.onLoadPhotos(booking.id));
    } finally {
      setLoadingPhotos(false);
    }
  }

  return (
    <article className="glass rounded-2xl p-5">
      {/* Kopf: Nummer, Status, Eingang */}
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <span className="display-card">{booking.customer.name}</span>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[booking.status]}`}
        >
          {booking.status}
        </span>
        {booking.isNewCustomer && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
            Neukunde
          </span>
        )}
        {booking.depositAmount > 0 && (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs ${
              booking.depositStatus === "bezahlt"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/15 text-amber-300"
            }`}
          >
            Anzahlung {currency(booking.depositAmount)}
            {booking.depositStatus === "bezahlt" ? " bezahlt" : " offen"}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {booking.invoiceNumber} · Eingang {eingang}
        </span>
      </header>

      <div className="grid gap-6 py-4 lg:grid-cols-2">
        {/* Kundendaten */}
        <div>
          <p className="label-caps mb-2 text-muted-foreground">Kontakt</p>
          <dl className="grid gap-1.5 text-sm">
            <div className="flex items-center gap-2">
              <Phone aria-hidden className="size-3.5 shrink-0 text-primary" />
              <a href={`tel:${booking.customer.phone}`} className="hover:text-primary">
                {booking.customer.phone}
              </a>
              <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[0.68rem] uppercase tracking-wider text-muted-foreground">
                bevorzugt: {booking.preferredContact}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Mail aria-hidden className="size-3.5 shrink-0 text-primary" />
              <a href={`mailto:${booking.customer.email}`} className="truncate hover:text-primary">
                {booking.customer.email}
              </a>
            </div>
          </dl>
        </div>

        {/* Fahrzeug und Termin */}
        <div>
          <p className="label-caps mb-2 text-muted-foreground">Fahrzeug &amp; Wunschtermin</p>
          <p className="text-sm text-foreground/85">
            {pkg?.name} · {vehicle?.name} · {booking.customer.plate}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <CalendarClock aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="text-foreground">{formatDate(booking.date)}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[0.68rem] ${
                belegt >= MAX_BOOKINGS_PER_DAY
                  ? "border-destructive/40 bg-destructive/15 text-destructive"
                  : "border-border bg-secondary/40 text-muted-foreground"
              }`}
            >
              {belegt} von {MAX_BOOKINGS_PER_DAY} Plätzen belegt
            </span>
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="display-price text-xl text-primary">{currency(preis)}</span>
            {booking.agreedPrice !== null && (
              <span className="text-xs text-muted-foreground line-through">
                {currency(booking.total)}
              </span>
            )}
          </p>
          {booking.offerNote && (
            <p className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground/80">Begründung im Angebot:</strong>{" "}
              {booking.offerNote}
            </p>
          )}
        </div>
      </div>

      {/* Zustandsfotos */}
      {photoCount > 0 && (
        <div className="border-t border-border py-4">
          <button
            type="button"
            onClick={togglePhotos}
            aria-expanded={photos !== null}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Camera aria-hidden className="size-4 text-primary" />
            {photos
              ? "Fotos ausblenden"
              : `${photoCount} Zustandsfoto${photoCount === 1 ? "" : "s"} ansehen`}
            {loadingPhotos && <span className="text-xs text-muted-foreground">wird geladen …</span>}
          </button>

          {photos && photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {photos.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setLightbox(index)}
                  aria-label={`Foto ${index + 1} in Großansicht öffnen`}
                  className="overflow-hidden rounded-lg border border-border outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img
                    src={url}
                    alt={`Zustandsfoto ${index + 1}`}
                    loading="lazy"
                    width={128}
                    height={96}
                    className="size-24 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          {photos && photos.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Keine Fotos abrufbar.</p>
          )}
        </div>
      )}

      {/* Aktionen */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {booking.status === "Wartend auf Prüfung" && (
          <>
            <Button
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await actions.onConfirm(booking.id);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? null : <CheckCircle2 className="size-4" />}
              Direkt bestätigen
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowOffer((open) => !open)}>
              Gegenangebot
            </Button>
          </>
        )}

        <select
          aria-label={`Status von ${booking.invoiceNumber} ändern`}
          value={booking.status}
          onChange={(event) => actions.onStatus(booking.id, event.target.value as BookingStatus)}
          className="h-9 rounded-lg border border-border bg-secondary/50 px-2 text-sm"
        >
          {bookingStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        {booking.depositStatus === "offen" && (
          <Button size="sm" variant="outline" onClick={() => actions.onDepositPaid(booking.id)}>
            <Wallet className="size-4" />
            Anzahlung erhalten
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={!legalDetailsVerified}
          title={
            legalDetailsVerified
              ? "Rechnung herunterladen"
              : "Zuerst geprüfte Firmen-, Steuer- und Bankdaten hinterlegen"
          }
          loading={invoiceBusy}
          onClick={() => actions.onInvoice(booking)}
        >
          {invoiceBusy ? null : <Download className="size-4" />}
          Rechnung
        </Button>

        <Button
          size="sm"
          variant="ghost"
          aria-label={`Buchung ${booking.invoiceNumber} löschen`}
          onClick={() => actions.onDelete(booking.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {showOffer && (
        <CounterOfferForm
          booking={booking}
          dayLoad={dayLoad}
          busy={busy}
          onCancel={() => setShowOffer(false)}
          onSubmit={async (price, note, altDates) => {
            setBusy(true);
            try {
              await actions.onCounterOffer(booking.id, price, note, altDates);
              setShowOffer(false);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {lightbox !== null && photos && photos.length > 0 && (
        <Lightbox
          urls={photos}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      )}
    </article>
  );
}
