import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/integrations/supabase/get-client";

type EligibleBooking = {
  id: string;
  booking_date: string;
  customer_name: string;
  status: string;
  customer_ready: boolean;
};

type ListResult = {
  ok: boolean;
  bookings?: EligibleBooking[];
  error?: string;
};

type PreviewResult = {
  ok: boolean;
  write_ready?: boolean;
  writes_performed?: boolean;
  booking_id?: string;
  error?: string;
  production_write?: {
    enabled?: boolean;
    booking_approved?: boolean;
    ready?: boolean;
    confirmation?: string | null;
  };
  customer?: {
    erpnext_customer_id?: string | null;
    state?: string;
  };
  vehicle?: {
    state?: "existing_exact_plate" | "create_needed";
    erpnext_vehicle_id?: string | null;
    identity_basis?: string;
    payload?: {
      registration_plate?: string;
      vehicle_class_label?: string;
    };
  };
  order?: {
    state?: "existing_booking_order" | "create_needed";
    erpnext_order_id?: string | null;
    payload?: {
      service_date?: string;
      status?: string;
      agreed_gross_total?: number | null;
      payment_status?: string;
    };
  };
  services?: Array<{
    item: string;
    item_name_snapshot: string;
    service_kind: string;
    qty: number;
  }>;
  notes?: {
    pickup_tier_not_inferred?: boolean;
  };
};

type CommitResult = {
  ok: boolean;
  error?: string;
  writes_performed?: boolean;
  idempotent_reuse?: boolean;
  vehicle_created?: boolean;
  order_created?: boolean;
  vehicle_id?: string;
  order_id?: string;
  financial_writes?: boolean;
};

function errorText(code: string | undefined) {
  if (!code) return "Vorschau konnte nicht abgeschlossen werden.";
  if (code === "customer_not_synced" || code === "customer_mapping_not_ready") {
    return "Der Kunde muss zuerst eindeutig mit ERPNext synchronisiert sein.";
  }
  if (code === "vehicle_plate_required_for_safe_identity") {
    return "Für die automatische Fahrzeugidentität ist ein gültiges Kennzeichen erforderlich.";
  }
  if (code === "vehicle_customer_conflict") {
    return "Das Kennzeichen ist in ERPNext bereits einem anderen Kunden zugeordnet. Manuelle Prüfung erforderlich.";
  }
  if (code === "multiple_vehicle_plate_matches") {
    return "Für dieses Kennzeichen wurden mehrere Fahrzeugtreffer gefunden. Automatische Verarbeitung wurde gestoppt.";
  }
  if (code === "order_customer_conflict" || code === "order_vehicle_conflict") {
    return "Ein vorhandener Auftrag widerspricht der erwarteten Kunden-/Fahrzeugzuordnung.";
  }
  if (code === "existing_order_without_exact_vehicle_match") {
    return "Zu dieser Buchung existiert bereits ein Auftrag, aber kein exakt passendes Fahrzeug. Manuelle Prüfung erforderlich.";
  }
  if (code === "service_catalog_not_ready_for_booking") {
    return "Mindestens eine Leistung dieser Buchung ist im ERPNext-Servicekatalog nicht sauber verfügbar.";
  }
  if (code === "erpnext_sync_requires_manual_review") {
    return "Der ERPNext-Sync ist wegen eines vorherigen Fehlers gesperrt und muss manuell geprüft werden.";
  }
  if (code === "booking_sync_busy_or_blocked") {
    return "Diese Buchung wird bereits verarbeitet oder ist nach einem Fehler gesperrt.";
  }
  if (code === "production_write_gate_disabled") {
    return "Das Produktions-Schreib-Gate ist serverseitig gesperrt.";
  }
  if (code === "production_write_booking_not_approved") {
    return "Diese Buchung ist nicht als kontrollierter Produktions-Schreibtest freigegeben.";
  }
  if (code === "explicit_write_confirmation_required") {
    return "Die buchungsgebundene Schreibbestätigung fehlt oder ist nicht mehr gültig.";
  }
  if (code.startsWith("unknown_addon_mapping:") || code === "unknown_package_mapping") {
    return "Die Buchung enthält eine Leistung, für die noch keine sichere ERPNext-Zuordnung existiert.";
  }
  if (code.startsWith("erpnext_")) {
    return "ERPNext konnte für diesen Vorgang nicht vollständig geprüft werden.";
  }
  return `Vorgang abgebrochen: ${code}`;
}

function stateText(state: string | undefined) {
  if (state === "existing_exact_plate") return "vorhanden · exaktes Kennzeichen";
  if (state === "existing_booking_order") return "vorhanden · gleiche Buchungs-ID";
  if (state === "create_needed") return "würde neu angelegt";
  return "nicht eindeutig";
}

export function ErpNextVehicleOrderPreviewCard() {
  const [bookings, setBookings] = useState<EligibleBooking[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<ListResult>(
        "erpnext-vehicle-order-preview",
        { body: { action: "list" } },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(errorText(data?.error));

      const next = data.bookings ?? [];
      setBookings(next);
      setSelectedId((current) => {
        if (current && next.some((booking) => booking.id === current)) return current;
        return next.find((booking) => booking.customer_ready)?.id ?? next[0]?.id ?? "";
      });
      setResult(null);
      setCommitResult(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Buchungen konnten nicht geladen werden.",
      );
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const runPreview = useCallback(async () => {
    if (!selectedId) return;
    setPreviewing(true);
    setResult(null);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<PreviewResult>(
        "erpnext-vehicle-order-preview",
        { body: { action: "preview", bookingId: selectedId } },
      );
      if (error) throw error;
      if (!data) throw new Error("ERPNext hat keine Vorschauantwort geliefert.");
      setResult(data);
      if (data.ok) {
        toast.success("Fahrzeug-/Auftragsvorschau abgeschlossen. Es wurde nichts geschrieben.");
      } else {
        toast.warning(errorText(data.error));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fahrzeug-/Auftragsvorschau fehlgeschlagen.";
      setResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setPreviewing(false);
    }
  }, [selectedId]);

  const runCommit = useCallback(async () => {
    const confirmation = result?.production_write?.confirmation;
    if (
      !selectedId ||
      !result?.ok ||
      !result.write_ready ||
      !result.production_write?.ready ||
      !confirmation
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Kontrollierten ERPNext-Schreibtest starten? Es werden nur das Kundenfahrzeug und der operative WHITE GLOSS Auftrag angelegt oder eindeutig wiederverwendet. Keine Rechnung, Zahlung, GL- oder Lagerbuchung.",
    );
    if (!confirmed) return;

    setCommitting(true);
    setCommitResult(null);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<CommitResult>(
        "erpnext-vehicle-order-commit",
        {
          body: {
            bookingId: selectedId,
            confirmation,
          },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("ERPNext hat keine Schreibantwort geliefert.");
      setCommitResult(data);
      if (!data.ok) {
        toast.warning(errorText(data.error));
        return;
      }

      toast.success(
        data.idempotent_reuse
          ? "ERPNext-Zuordnung bestätigt. Es wurde kein Duplikat erzeugt."
          : "Fahrzeug und Auftrag wurden kontrolliert in ERPNext angelegt.",
      );
      await runPreview();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Kontrollierter ERPNext-Schreibtest fehlgeschlagen.";
      setCommitResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setCommitting(false);
    }
  }, [result, runPreview, selectedId]);

  const selected = bookings.find((booking) => booking.id === selectedId);

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Eye aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">
              Buchung → Fahrzeug → Auftrag · Vorschau
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300">
              <ShieldCheck aria-hidden className="size-3" />
              Vorschau ohne Schreibzugriff
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prüft eine bestätigte oder bezahlte Buchung vollständig gegen den bereits
            synchronisierten ERPNext-Kunden, das Kundenfahrzeug, den operativen Auftrag und den
            freigegebenen Service-Katalog. Die Vorschau legt nichts an und verändert nichts.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1.5 block text-muted-foreground">Buchung auswählen</span>
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setResult(null);
                  setCommitResult(null);
                }}
                disabled={loadingBookings || bookings.length === 0 || committing}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                {bookings.length === 0 ? (
                  <option value="">Keine bestätigte/bezahlte Buchung gefunden</option>
                ) : (
                  bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.booking_date} · {booking.customer_name} · {booking.status}
                      {booking.customer_ready
                        ? " · Kunde bereit"
                        : " · Kunde zuerst synchronisieren"}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={loadingBookings}
                disabled={committing}
                onClick={() => void loadBookings()}
              >
                {loadingBookings ? null : <RefreshCw aria-hidden className="size-4" />}
                Aktualisieren
              </Button>
              <Button
                type="button"
                size="sm"
                loading={previewing}
                disabled={!selectedId || selected?.customer_ready === false || committing}
                onClick={() => void runPreview()}
              >
                {previewing ? null : <Eye aria-hidden className="size-4" />}
                Mapping prüfen
              </Button>
            </div>
          </div>

          {selected && !selected.customer_ready ? (
            <p className="mt-2 text-xs text-amber-300">
              Diese Buchung hat noch keine bestätigte ERPNext-Kundenzuordnung. Bitte zuerst den
              Kundensync abschließen.
            </p>
          ) : null}

          {result ? (
            <div
              className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${
                result.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              <div className="flex items-start gap-2">
                {result.ok ? (
                  <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  {result.ok ? (
                    <div className="space-y-2">
                      <p className="font-medium">Vollständige Mapping-Vorschau ist bereit.</p>
                      <p className="text-xs opacity-85">
                        Kunde: {result.customer?.erpnext_customer_id ?? "bereit"}
                      </p>
                      <p className="text-xs opacity-85">
                        Fahrzeug: {stateText(result.vehicle?.state)}
                        {result.vehicle?.payload?.registration_plate
                          ? ` · ${result.vehicle.payload.registration_plate}`
                          : ""}
                        {result.vehicle?.payload?.vehicle_class_label
                          ? ` · ${result.vehicle.payload.vehicle_class_label}`
                          : ""}
                      </p>
                      <p className="text-xs opacity-85">
                        Auftrag: {stateText(result.order?.state)}
                        {result.order?.payload?.service_date
                          ? ` · ${result.order.payload.service_date}`
                          : ""}
                        {result.order?.payload?.status ? ` · ${result.order.payload.status}` : ""}
                      </p>
                      <p className="text-xs opacity-85">
                        Leistungen:{" "}
                        {(result.services ?? []).map((service) => service.item).join(", ")}
                      </p>
                      {result.notes?.pickup_tier_not_inferred ? (
                        <p className="text-xs text-amber-200/90">
                          Hol-/Bringservice erkannt. Der konkrete Entfernungs-Tarif wird bewusst
                          nicht aus Ortsnamen oder Gesamtpreis geraten; die operative Vorschau
                          verwendet nur den freigegebenen Hol-/Bringservice-Code.
                        </p>
                      ) : null}
                      <p className="text-xs opacity-80">
                        Schreibvorgänge: {result.writes_performed ? "ja" : "keine"} · Mapping-Gate:{" "}
                        {result.write_ready ? "bereit" : "nicht bereit"} · Produktions-Gate:{" "}
                        {result.production_write?.ready ? "freigegeben" : "gesperrt"}.
                      </p>
                    </div>
                  ) : (
                    <p>{errorText(result.error)}</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {result?.ok && result.write_ready && !result.production_write?.ready ? (
            <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100">
              <div className="flex items-start gap-2">
                <ShieldCheck aria-hidden className="mt-1 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Produktions-Write technisch gesperrt</p>
                  <p className="mt-1 text-xs opacity-90">
                    Die Mapping-Vorschau ist vollständig. Ein echter Schreibvorgang wird erst
                    möglich, wenn der serverseitige Schalter aktiviert und genau diese Buchungs-ID
                    separat freigegeben wurde.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {result?.ok &&
          result.write_ready &&
          result.production_write?.ready &&
          result.production_write.confirmation ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              <div className="flex items-start gap-2">
                <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Kontrollierter Schreibtest</p>
                  <p className="mt-1 text-xs opacity-90">
                    Legt ausschließlich das eindeutige Kundenfahrzeug und den operativen WHITE GLOSS
                    Auftrag an oder verwendet bereits vorhandene eindeutige Datensätze. Rechnungen,
                    Zahlungen, GL- und Lagerbuchungen bleiben unberührt.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3"
                    loading={committing}
                    disabled={previewing}
                    onClick={() => void runCommit()}
                  >
                    {committing ? null : <ShieldCheck aria-hidden className="size-4" />}
                    Fahrzeug & Auftrag anlegen
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {commitResult ? (
            <div
              className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${
                commitResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              <div className="flex items-start gap-2">
                {commitResult.ok ? (
                  <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  {commitResult.ok ? (
                    <div className="space-y-1 text-xs">
                      <p className="text-sm font-medium">
                        {commitResult.idempotent_reuse
                          ? "Eindeutige ERPNext-Zuordnung wiederverwendet."
                          : "Kontrollierter ERPNext-Schreibtest erfolgreich."}
                      </p>
                      <p>Fahrzeug: {commitResult.vehicle_id ?? "nicht bestätigt"}</p>
                      <p>Auftrag: {commitResult.order_id ?? "nicht bestätigt"}</p>
                      <p>
                        Neu angelegt: Fahrzeug {commitResult.vehicle_created ? "ja" : "nein"} ·
                        Auftrag {commitResult.order_created ? "ja" : "nein"}
                      </p>
                      <p>Finanzbuchungen: {commitResult.financial_writes ? "ja" : "keine"}</p>
                    </div>
                  ) : (
                    <p>{errorText(commitResult.error)}</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
