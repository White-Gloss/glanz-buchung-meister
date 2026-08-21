import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
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

const CONFIRMATION = "CREATE_WHITE_GLOSS_VEHICLE_ORDER_V1";

function errorText(code: string | undefined) {
  if (!code) return "Der kontrollierte Schreibtest konnte nicht abgeschlossen werden.";
  if (code === "customer_not_synced" || code === "customer_mapping_not_ready") {
    return "Der Kunde ist noch nicht eindeutig mit ERPNext synchronisiert.";
  }
  if (code === "booking_sync_busy_or_blocked") {
    return "Diese Buchung wird bereits verarbeitet oder ist wegen eines früheren Fehlers gesperrt.";
  }
  if (code === "erpnext_sync_requires_manual_review") {
    return "Für diese Buchung ist vor einem neuen Schreibversuch eine manuelle Prüfung erforderlich.";
  }
  if (code === "vehicle_customer_conflict" || code === "order_customer_conflict") {
    return "ERPNext enthält einen widersprüchlichen Kundenbezug. Der Schreibvorgang wurde gestoppt.";
  }
  if (code === "order_vehicle_conflict" || code === "multiple_vehicle_plate_matches") {
    return "ERPNext enthält eine nicht eindeutige Fahrzeug-/Auftragszuordnung. Der Schreibvorgang wurde gestoppt.";
  }
  if (code.startsWith("uncertain_")) {
    return "ERPNext hat einen unklaren Schreibzustand gemeldet. Es erfolgt kein automatischer Wiederholungsversuch.";
  }
  if (code.startsWith("erpnext_")) {
    return "ERPNext konnte den kontrollierten Schreibtest nicht sicher abschließen.";
  }
  return `Schreibtest abgebrochen: ${code}`;
}

export function ErpNextVehicleOrderCommitCard() {
  const [bookings, setBookings] = useState<EligibleBooking[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<ListResult>(
        "erpnext-vehicle-order-preview",
        { body: { action: "list" } },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "booking_list_failed");

      const next = (data.bookings ?? []).filter((booking) => booking.customer_ready);
      setBookings(next);
      setSelectedId((current) => {
        if (current && next.some((booking) => booking.id === current)) return current;
        return next[0]?.id ?? "";
      });
      setResult(null);
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

  const runCommit = useCallback(async () => {
    if (!selectedId) return;
    setCommitting(true);
    setResult(null);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<CommitResult>(
        "erpnext-vehicle-order-commit",
        {
          body: {
            bookingId: selectedId,
            confirmation: CONFIRMATION,
          },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("ERPNext hat keine Antwort geliefert.");
      setResult(data);
      if (data.ok) {
        toast.success(
          data.idempotent_reuse
            ? "Vorhandenes Fahrzeug und vorhandener Auftrag wurden sicher wiederverwendet."
            : "Fahrzeug-/Auftragsschreibtest erfolgreich abgeschlossen.",
        );
      } else {
        toast.warning(errorText(data.error));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fahrzeug-/Auftragsschreibtest fehlgeschlagen.";
      setResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setCommitting(false);
    }
  }, [selectedId]);

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">Fahrzeug & Auftrag · Schreibtest</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-200">
              kontrollierter Produktions-Write
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Legt für genau eine bereits geprüfte Buchung das WHITE-GLOSS-Kundenfahrzeug und den
            operativen WHITE-GLOSS-Auftrag an. Exakte Kennzeichen- und Buchungs-ID-Prüfungen sowie
            ein atomarer Claim verhindern parallele Dubletten. Rechnungen, Zahlungen, Lager und
            Hauptbuch bleiben unberührt.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1.5 block text-muted-foreground">Freigegebene Buchung</span>
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setResult(null);
                }}
                disabled={loadingBookings || bookings.length === 0 || committing}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                {bookings.length === 0 ? (
                  <option value="">Keine schreibbereite Buchung gefunden</option>
                ) : (
                  bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.booking_date} · {booking.customer_name} · {booking.status}
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
                loading={committing}
                disabled={!selectedId || loadingBookings}
                onClick={() => void runCommit()}
              >
                {committing ? null : <ShieldCheck aria-hidden className="size-4" />}
                Fahrzeug & Auftrag anlegen
              </Button>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Der Endpunkt akzeptiert ausschließlich den fest hinterlegten Bestätigungstoken und
            schreibt keine Finanzbelege.
          </p>

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
                    <div className="space-y-1">
                      <p className="font-medium">Kontrollierter Schreibtest erfolgreich.</p>
                      <p className="text-xs opacity-85">
                        Fahrzeug: {result.vehicle_id ?? "unbekannt"} ·{" "}
                        {result.vehicle_created ? "neu angelegt" : "wiederverwendet"}
                      </p>
                      <p className="text-xs opacity-85">
                        Auftrag: {result.order_id ?? "unbekannt"} ·{" "}
                        {result.order_created ? "neu angelegt" : "wiederverwendet"}
                      </p>
                      <p className="text-xs opacity-80">
                        Finanzschreibvorgänge: {result.financial_writes ? "ja" : "keine"}
                      </p>
                    </div>
                  ) : (
                    <p>{errorText(result.error)}</p>
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
