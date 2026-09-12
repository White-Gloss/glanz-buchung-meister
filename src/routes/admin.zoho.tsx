import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  setZohoOpsSwitch,
  zohoComplete,
  zohoConfirm,
  zohoProbeSetup,
  zohoReject,
  zohoRunSync,
  zohoSaveSetup,
  zohoWorkplace,
} from "@/lib/zoho.functions";
import { defaultDurationMinutes } from "@/lib/zoho-time";
import { packages, extras, vehicleClasses } from "@/data/site";
import { eur } from "@/lib/utils";
import { Button, Field, inputClass } from "@/components/ui";

export const Route = createFileRoute("/admin/zoho")({
  component: AdminZoho,
});

type Workplace = Awaited<ReturnType<typeof zohoWorkplace>>;
type Booking = Workplace["bookings"][number];

const stageLabel: Record<string, string> = {
  anfrage_eingegangen: "Anfrage eingegangen",
  in_pruefung: "In Prüfung",
  kundenrueckmeldung: "Wartet auf Kundenannahme",
  bestaetigt: "Bestätigt",
  in_bearbeitung: "In Bearbeitung",
  abgeschlossen: "Abgeschlossen",
  abgelehnt: "Abgelehnt",
  storniert: "Storniert",
};

function extraLabel(raw: string | null) {
  try {
    const ids = JSON.parse(raw || "[]") as string[];
    return extras
      .filter((item) => ids.includes(item.id))
      .map((item) => item.name)
      .join(", ");
  } catch {
    return "";
  }
}

function berlinToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function AdminZoho() {
  const [data, setData] = useState<Workplace | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("180");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [cashEuros, setCashEuros] = useState("");
  const [cashDate, setCashDate] = useState(berlinToday());
  const [payment, setPayment] = useState<"bar" | "ueberweisung">("ueberweisung");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [grantCode, setGrantCode] = useState("");
  const [booksOrgId, setBooksOrgId] = useState("");
  const [setupNote, setSetupNote] = useState("");

  async function reload() {
    const next = await zohoWorkplace();
    setData(next);
    return next;
  }

  useEffect(() => {
    void reload().catch(() => setError("Arbeitsplatz konnte nicht geladen werden."));
  }, []);

  const selected = useMemo(
    () => data?.bookings.find((row) => row.id === selectedId) ?? null,
    [data, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setStartDate(selected.preferred_date?.slice(0, 10) || berlinToday());
    setStartTime(selected.preferred_slot || "09:00");
    setEndDate("");
    setEndTime("");
    setDuration(String(defaultDurationMinutes[selected.package_id] ?? 180));
    setPrice(
      ((selected.agreed_price_cents ?? selected.estimated_price_cents ?? selected.total_cents) / 100).toFixed(2),
    );
    setNotes(selected.internal_notes || "");
    setAccepted(Boolean(selected.customer_accepted_at));
    setCashEuros(
      ((selected.payment_recorded_cents ?? selected.agreed_price_cents ?? selected.total_cents) / 100).toFixed(2),
    );
    setCashDate(selected.payment_recorded_on || berlinToday());
    setPayment(selected.payment_method === "bar" ? "bar" : "ueberweisung");
  }, [selected?.id, selected?.version]);

  const photos = data?.photos.filter((photo) => photo.bookingId === selectedId) ?? [];
  const jobs = data?.jobs.filter((job) => job.booking_id === selectedId) ?? [];

  async function act(work: () => Promise<unknown>, message: string) {
    if (pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await work();
      await reload();
      setNotice(typeof result === "string" ? result : message);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aktion fehlgeschlagen.");
      return null;
    } finally {
      setPending(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Betrieb</p>
      <h1 className="mt-2 font-display text-4xl">Zoho-Arbeitsplatz</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Website-Anfragen werden hier geprüft, mit Preis und Bearbeitungszeit bestätigt und erst nach
        erbrachter Leistung abgerechnet. Postgres sperrt die Werkstatt. Zoho CRM und Zoho Books
        übernehmen die operative Ansicht, sobald die Verbindung steht.
      </p>

      {data ? (
        <div className="mt-6 rounded-md border border-line bg-surface p-5 text-sm">
          <p>
            Zoho CRM/Books: {data.connected ? `verbunden (${data.dc})` : "noch nicht verbunden"}
            {data.hasOrg ? " · Books-Organisation vorhanden" : " · Books-Organisation fehlt"}
          </p>
          <p className="mt-2 text-muted">
            {data.connected
              ? "Offene Anfragen gehören in Zoho CRM als Deal. Dieser Arbeitsplatz bleibt die technische Reservierung und zeigt Übertragungsfehler."
              : "Du musst kein Refresh-Token verstehen. In Zoho holst du einen kurzen Code, hier fügst du ihn ein — den Dauerschlüssel erzeugt die App selbst."}
          </p>
          {data.canConfirm ? (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void act(async () => {
                  const report = await zohoSaveSetup({
                    data: {
                      clientId: clientId || undefined,
                      clientSecret: clientSecret || undefined,
                      grantCode: grantCode || undefined,
                      booksOrgId: booksOrgId || undefined,
                    },
                  });
                  setClientSecret("");
                  setGrantCode("");
                  const lines = [
                    report.auth ? "Verbindung steht." : "Noch nicht verbunden.",
                    report.orgName
                      ? `Books: ${report.orgName}`
                      : report.orgId
                        ? `Books-Mandant ${report.orgId}`
                        : "Books-Mandant fehlt.",
                    report.tax19
                      ? "19 % MwSt. in Books gefunden."
                      : "19 % MwSt. in Books fehlt — nicht erfunden.",
                    report.crm ? "CRM erreichbar." : "CRM nicht erreichbar.",
                    report.webhookSecretPreview
                      ? `Webhook-Geheimnis (einmalig notieren): ${report.webhookSecretPreview}`
                      : "",
                    ...report.errors,
                  ].filter(Boolean);
                  setSetupNote(lines.join(" "));
                  return lines.join(" ");
                }, "Verbindung geprüft.");
              }}
            >
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted sm:col-span-2">
                <li>
                  Öffne{" "}
                  <a className="underline" href="https://api-console.zoho.eu" target="_blank" rel="noreferrer">
                    api-console.zoho.eu
                  </a>{" "}
                  mit deinem Zoho-Konto (Europa, dasselbe wie CRM und Books).
                </li>
                <li>
                  <strong>Add Client</strong> → <strong>Self Client</strong>. Unter{" "}
                  <strong>Client Secret</strong> siehst du Client-ID und Secret — die beiden oberen Felder.
                </li>
                <li>
                  Reiter <strong>Generate Code</strong>. Bei Scope genau das einfügen:
                  <code className="mt-1 block break-all rounded-md bg-bg px-2 py-1 text-xs text-fg">
                    ZohoCRM.modules.ALL,ZohoCRM.files.CREATE,ZohoBooks.fullaccess.all
                  </code>
                  Zeit <strong>10 minutes</strong>, dann Create. Wenn Zoho fragt: CRM und Books, deutscher
                  Mandant, Production.
                </li>
                <li>
                  Den angezeigten Code sofort ins Feld <strong>Code aus Zoho</strong> kopieren und speichern.
                  Er gilt nur wenige Minuten. Das Refresh-Token erzeugt die App daraus selbst.
                </li>
              </ol>
              <Field id="zoho-client" label="Client-ID">
                <input
                  id="zoho-client"
                  className={inputClass}
                  value={clientId}
                  autoComplete="off"
                  placeholder={data.hasClient ? "liegt vor — leer lassen zum Behalten" : "beginnt oft mit 1000."}
                  onChange={(event) => setClientId(event.target.value)}
                />
              </Field>
              <Field id="zoho-secret" label="Client-Secret">
                <input
                  id="zoho-secret"
                  type="password"
                  className={inputClass}
                  value={clientSecret}
                  autoComplete="new-password"
                  placeholder="aus der Konsole, nicht in den Chat"
                  onChange={(event) => setClientSecret(event.target.value)}
                />
              </Field>
              <Field id="zoho-grant" label="Code aus Zoho (Generate Code)">
                <input
                  id="zoho-grant"
                  className={inputClass}
                  value={grantCode}
                  autoComplete="off"
                  placeholder="den kurzen Code, nicht irgendetwas mit refresh"
                  onChange={(event) => setGrantCode(event.target.value)}
                />
              </Field>
              <Field id="zoho-org" label="Books-Mandant (meist leer lassen)">
                <input
                  id="zoho-org"
                  className={inputClass}
                  value={booksOrgId}
                  placeholder={data.hasOrg ? "bereits gesetzt" : "leer = App liest den Mandanten"}
                  onChange={(event) => setBooksOrgId(event.target.value)}
                />
              </Field>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  Code einlösen und verbinden
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    void act(async () => {
                      const report = await zohoProbeSetup();
                      const text = [
                        report.auth ? "OAuth gültig." : "OAuth fehlt.",
                        report.tax19 ? "19 % Steuer gefunden." : "19 % Steuer fehlt.",
                        report.crm ? "CRM ok." : "CRM fehlt.",
                        ...report.errors,
                      ].join(" ");
                      setSetupNote(text);
                      return text;
                    }, "Prüfung abgeschlossen.")
                  }
                >
                  Nur prüfen, nichts speichern
                </Button>
              </div>
              {setupNote ? <p className="text-sm text-muted sm:col-span-2">{setupNote}</p> : null}
            </form>
          ) : (
            <p className="mt-4 text-muted">
              Nur das Inhaberkonto darf Client-ID, Secret und Refresh-Token speichern.
            </p>
          )}
          <p className="mt-2 text-muted">
            Alte Lexware-/Odoo-/RO-App-Automatiken bleiben aktiv, bis der kontrollierte Wechsel
            eingeschaltet wird. Derzeit: {data.enabled ? "Zoho führt den Betrieb" : "Wechsel noch nicht aktiv"}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.canConfirm ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  void act(
                    () => setZohoOpsSwitch({ data: { enabled: !data.enabled } }),
                    data.enabled
                      ? "Zoho-Betriebspriorität ausgeschaltet. Alte Automatiken laufen wieder."
                      : "Zoho-Betriebspriorität eingeschaltet. Neue Lexware-Rechnungen werden nicht mehr angestoßen.",
                  )
                }
              >
                {data.enabled ? "Wechsel zurücknehmen" : "Zoho als führendes System einschalten"}
              </Button>
            ) : (
              <p className="text-muted">Nur das Inhaberkonto darf den Wechsel schalten.</p>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => void act(() => zohoRunSync(), "Übertragung angestoßen.")}
            >
              Warteschlange jetzt verarbeiten
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => void reload()}>
              Aktualisieren
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 text-sm" role="status">
          {notice}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <section className="rounded-md border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-3 font-display text-xl">Anfragen</h2>
          <ul className="max-h-[70vh] divide-y divide-line overflow-auto">
            {(data?.bookings ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`block w-full px-4 py-3 text-left text-sm ${
                    selectedId === row.id ? "bg-elevated" : ""
                  }`}
                >
                  <span className="block text-xs text-subtle">WG-{row.id}</span>
                  <span className="block font-medium">{row.customer_name}</span>
                  <span className="block text-muted">
                    {stageLabel[row.ops_stage] || row.status} · {row.workLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          {!selected ? (
            <p className="text-sm text-muted">Eine Anfrage auswählen, um Preis, Dauer und Abschluss zu prüfen.</p>
          ) : (
            <BookingDesk
              row={selected}
              photos={photos}
              jobs={jobs}
              pending={pending}
              canConfirm={Boolean(data?.canConfirm)}
              startDate={startDate}
              startTime={startTime}
              endDate={endDate}
              endTime={endTime}
              duration={duration}
              price={price}
              notes={notes}
              accepted={accepted}
              cashEuros={cashEuros}
              cashDate={cashDate}
              payment={payment}
              setStartDate={setStartDate}
              setStartTime={setStartTime}
              setEndDate={setEndDate}
              setEndTime={setEndTime}
              setDuration={setDuration}
              setPrice={setPrice}
              setNotes={setNotes}
              setAccepted={setAccepted}
              setCashEuros={setCashEuros}
              setCashDate={setCashDate}
              setPayment={setPayment}
              onConfirm={() =>
                void act(async () => {
                  const euros = Number(price.replace(",", "."));
                  if (!Number.isFinite(euros) || euros <= 0) {
                    throw new Error("Bitte einen vereinbarten Preis größer 0 angeben.");
                  }
                  const result = await zohoConfirm({
                    data: {
                      id: selected.id,
                      expectedVersion: selected.version,
                      startDate,
                      startTime,
                      endDate: endDate || undefined,
                      endTime: endTime || undefined,
                      durationMinutes: Number(duration) || undefined,
                      agreedCents: Math.round(euros * 100),
                      internalNotes: notes,
                      customerAccepted: accepted,
                    },
                  });
                  if (result.awaitingCustomer) {
                    return "Preis oder Termin weicht vom Wunsch ab. Es wurde noch nicht reserviert. Nach der Kundenannahme mit gesetztem Haken erneut bestätigen.";
                  }
                }, "Termin bestätigt. Die Buchungsbestätigung (keine Rechnung) geht nach erfolgreicher Reservierung raus.")
              }
              onReject={(status) =>
                void act(
                  () =>
                    zohoReject({
                      data: { id: selected.id, expectedVersion: selected.version, status },
                    }),
                  status === "abgelehnt" ? "Anfrage abgelehnt." : "Termin storniert.",
                )
              }
              onComplete={() =>
                void act(async () => {
                  const cash = Number(cashEuros.replace(",", "."));
                  await zohoComplete({
                    data: {
                      id: selected.id,
                      expectedVersion: selected.version,
                      payment,
                      cashCents: payment === "bar" ? Math.round(cash * 100) : undefined,
                      cashDate: payment === "bar" ? cashDate : undefined,
                    },
                  });
                }, "Leistung abgeschlossen. Rechnung entsteht nur jetzt, nicht durch den Kalender.")
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}

function BookingDesk({
  row,
  photos,
  jobs,
  pending,
  canConfirm,
  startDate,
  startTime,
  endDate,
  endTime,
  duration,
  price,
  notes,
  accepted,
  cashEuros,
  cashDate,
  payment,
  setStartDate,
  setStartTime,
  setEndDate,
  setEndTime,
  setDuration,
  setPrice,
  setNotes,
  setAccepted,
  setCashEuros,
  setCashDate,
  setPayment,
  onConfirm,
  onReject,
  onComplete,
}: {
  row: Booking;
  photos: Workplace["photos"];
  jobs: Workplace["jobs"];
  pending: boolean;
  canConfirm: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  duration: string;
  price: string;
  notes: string;
  accepted: boolean;
  cashEuros: string;
  cashDate: string;
  payment: "bar" | "ueberweisung";
  setStartDate: (value: string) => void;
  setStartTime: (value: string) => void;
  setEndDate: (value: string) => void;
  setEndTime: (value: string) => void;
  setDuration: (value: string) => void;
  setPrice: (value: string) => void;
  setNotes: (value: string) => void;
  setAccepted: (value: boolean) => void;
  setCashEuros: (value: string) => void;
  setCashDate: (value: string) => void;
  setPayment: (value: "bar" | "ueberweisung") => void;
  onConfirm: () => void;
  onReject: (status: "abgelehnt" | "storniert") => void;
  onComplete: () => void;
}) {
  const pack = packages.find((item) => item.id === row.package_id);
  const vehicle = [row.vehicle_make, row.vehicle_model, row.vehicle_plate]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-subtle">WG-{row.id} · Version {row.version}</p>
        <h2 className="font-display text-3xl">{row.customer_name}</h2>
        <p className="mt-1 text-sm text-muted">
          <a href={`tel:${row.phone}`}>{row.phone}</a>
          {row.email ? (
            <>
              {" · "}
              <a href={`mailto:${row.email}`}>{row.email}</a>
            </>
          ) : null}
        </p>
        <p className="mt-2 text-sm">
          {stageLabel[row.ops_stage] || row.status} · {pack?.name || row.package_id} ·{" "}
          {vehicleClasses.find((item) => item.id === row.class_id)?.label || row.class_id}
          {vehicle ? ` · ${vehicle}` : ""}
        </p>
        <p className="mt-1 text-sm text-muted">
          Schätzung {eur((row.estimated_price_cents ?? row.total_cents) / 100)}
          {row.agreed_price_cents != null ? ` · vereinbart ${eur(row.agreed_price_cents / 100)}` : ""}
          {extraLabel(row.extra_ids) ? ` · ${extraLabel(row.extra_ids)}` : ""}
        </p>
        {row.note ? <p className="mt-3 whitespace-pre-wrap text-sm">{row.note}</p> : null}
        {row.zoho_last_error ? (
          <p className="mt-3 text-sm text-danger">Zoho: {row.zoho_last_error}</p>
        ) : null}
        {row.zoho_invoice_number ? (
          <p className="mt-2 text-sm">Rechnung {row.zoho_invoice_number} · {row.invoice_status}</p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Rechnung: {row.invoice_status === "nicht_erstellt" ? "noch keine" : row.invoice_status}
          </p>
        )}
      </div>

      {photos.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((photo) =>
            photo.url ? (
              <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                <img src={photo.url} alt={photo.name} className="h-28 w-full rounded-md object-cover" />
              </a>
            ) : (
              <p key={photo.id} className="text-xs text-muted">
                {photo.name} ({photo.state})
              </p>
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Keine Fahrzeugfotos hinterlegt.</p>
      )}

      {row.status === "neu" || row.ops_stage === "kundenrueckmeldung" ? (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
          }}
        >
          <Field id="startDate" label="Beginn Datum">
            <input
              id="startDate"
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </Field>
          <Field id="startTime" label="Beginn Uhrzeit">
            <input
              id="startTime"
              type="time"
              className={inputClass}
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </Field>
          <Field id="duration" label="Dauer in Minuten">
            <input
              id="duration"
              type="number"
              min={30}
              max={20160}
              className={inputClass}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </Field>
          <Field id="price" label="Vereinbarter Preis brutto (€)">
            <input
              id="price"
              inputMode="decimal"
              className={inputClass}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </Field>
          <Field id="endDate" label="Ende Datum (optional)">
            <input
              id="endDate"
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </Field>
          <Field id="endTime" label="Ende Uhrzeit (optional)">
            <input
              id="endTime"
              type="time"
              className={inputClass}
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field id="notes" label="Interne Notiz">
              <textarea
                id="notes"
                className={`${inputClass} min-h-24 py-2`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </div>
          {row.customer_acceptance_required || row.ops_stage === "kundenrueckmeldung" ? (
            <label className="sm:col-span-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              Kunde hat den geänderten Preis oder Termin angenommen. Erst dann wird reserviert.
            </label>
          ) : null}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            {canConfirm ? (
              <Button type="submit" disabled={pending}>
                Termin bestätigen
              </Button>
            ) : (
              <p className="text-sm text-muted">Bestätigung nur durch das Inhaberkonto.</p>
            )}
            <Button type="button" variant="ghost" disabled={pending} onClick={() => onReject("abgelehnt")}>
              Ablehnen
            </Button>
          </div>
        </form>
      ) : null}

      {row.status === "bestaetigt" ? (
        <div className="space-y-4 border-t border-line pt-4">
          <p className="text-sm">Bestätigter Zeitraum: {row.workLabel}</p>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="text-sm font-medium">Leistungsabschluss und Zahlung</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="payment"
                checked={payment === "ueberweisung"}
                onChange={() => setPayment("ueberweisung")}
              />
              Überweisung, 7 Tage
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="payment"
                checked={payment === "bar"}
                onChange={() => setPayment("bar")}
              />
              Barzahlung
            </label>
            {payment === "bar" ? (
              <>
                <Field id="cashEuros" label="Erhaltener Betrag (€)">
                  <input
                    id="cashEuros"
                    className={inputClass}
                    value={cashEuros}
                    onChange={(event) => setCashEuros(event.target.value)}
                  />
                </Field>
                <Field id="cashDate" label="Zahlungsdatum">
                  <input
                    id="cashDate"
                    type="date"
                    className={inputClass}
                    value={cashDate}
                    onChange={(event) => setCashDate(event.target.value)}
                  />
                </Field>
              </>
            ) : null}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending || !canConfirm} onClick={onComplete}>
              Dienstleistung abgeschlossen
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => onReject("storniert")}>
              Stornieren
            </Button>
          </div>
        </div>
      ) : null}

      {jobs.length ? (
        <ul className="border-t border-line pt-4 text-xs text-muted">
          {jobs.map((job) => (
            <li key={job.id}>
              {job.job} · {job.status}
              {job.last_error ? ` · ${job.last_error}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
