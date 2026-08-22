import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/integrations/supabase/get-client";

type SyncedBooking = {
  id: string;
  booking_date: string;
  customer_name: string;
  status: string;
  erpnext_vehicle_id: string;
  erpnext_order_id: string;
  synced_at: string;
};

type ListResult = {
  ok: boolean;
  bookings?: SyncedBooking[];
  error?: string;
};

type VerifyResult = {
  ok: boolean;
  writes_performed?: boolean;
  booking_id?: string;
  vehicle_id?: string;
  order_id?: string;
  error?: string;
  failed_checks?: string[];
  duplicate_counts?: {
    vehicle_by_plate?: number;
    order_by_booking?: number;
  };
  services?: string[];
  financial_links?: {
    sales_invoice?: string | null;
  };
};

function errorText(code: string | undefined) {
  if (!code) return "Die Nachprüfung konnte nicht abgeschlossen werden.";
  if (code === "sync_state_not_verifiable") {
    return "Für diese Buchung liegt noch kein vollständig verifizierbarer ERPNext-Synchronisationsstand vor.";
  }
  if (code.startsWith("erpnext_")) {
    return "ERPNext konnte für die Nachprüfung nicht vollständig gelesen werden.";
  }
  return `Nachprüfung abgebrochen: ${code}`;
}

export function ErpNextVehicleOrderVerifyCard() {
  const [bookings, setBookings] = useState<SyncedBooking[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<ListResult>(
        "erpnext-vehicle-order-verify",
        { body: { action: "list" } },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(errorText(data?.error));

      const next = data.bookings ?? [];
      setBookings(next);
      setSelectedId((current) => {
        if (current && next.some((booking) => booking.id === current)) return current;
        return next[0]?.id ?? "";
      });
      setResult(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Synchronisierte Buchungen konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const verify = useCallback(async () => {
    if (!selectedId) return;
    setVerifying(true);
    setResult(null);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<VerifyResult>(
        "erpnext-vehicle-order-verify",
        { body: { bookingId: selectedId } },
      );
      if (error) throw error;
      if (!data) throw new Error("ERPNext hat keine Prüfantwort geliefert.");
      setResult(data);
      if (data.ok) {
        toast.success("ERPNext-Fahrzeug und -Auftrag sind konsistent verifiziert.");
      } else {
        toast.warning(errorText(data.error));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ERPNext-Nachprüfung ist fehlgeschlagen.";
      setResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  }, [selectedId]);

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">Fahrzeug & Auftrag · Nachprüfung</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300">
              ausschließlich lesend
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prüft nach einer Synchronisierung die gespeicherten ERPNext-IDs, Kunden- und
            Fahrzeugbezüge, Dublettenfreiheit, Buchungsdatum, Date-only-Regel, Leistungen,
            Gesamtbetrag und den fehlenden Finanzbeleg-Link. Dabei wird nichts geschrieben.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1.5 block text-muted-foreground">Synchronisierte Buchung</span>
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setResult(null);
                }}
                disabled={loading || verifying || bookings.length === 0}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                {bookings.length === 0 ? (
                  <option value="">Noch keine vollständig synchronisierte Buchung gefunden</option>
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
                loading={loading}
                disabled={verifying}
                onClick={() => void loadBookings()}
              >
                {loading ? null : <RefreshCw aria-hidden className="size-4" />}
                Aktualisieren
              </Button>
              <Button
                type="button"
                size="sm"
                loading={verifying}
                disabled={!selectedId || loading}
                onClick={() => void verify()}
              >
                {verifying ? null : <ShieldCheck aria-hidden className="size-4" />}
                Synchronisierung prüfen
              </Button>
            </div>
          </div>

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
                      <p className="font-medium">Post-Write-Verifikation vollständig bestanden.</p>
                      <p className="text-xs opacity-85">Fahrzeug: {result.vehicle_id ?? "–"}</p>
                      <p className="text-xs opacity-85">Auftrag: {result.order_id ?? "–"}</p>
                      <p className="text-xs opacity-85">
                        Dubletten: Fahrzeug {result.duplicate_counts?.vehicle_by_plate ?? "?"} · Auftrag{" "}
                        {result.duplicate_counts?.order_by_booking ?? "?"}
                      </p>
                      <p className="text-xs opacity-85">
                        Leistungen: {(result.services ?? []).join(", ") || "–"}
                      </p>
                      <p className="text-xs opacity-80">
                        Verknüpfte ERPNext-Rechnung: {result.financial_links?.sales_invoice ?? "keine"} ·
                        Schreibvorgänge: {result.writes_performed ? "ja" : "keine"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p>{errorText(result.error)}</p>
                      {result.failed_checks?.length ? (
                        <p className="text-xs opacity-85">
                          Fehlgeschlagene Prüfungen: {result.failed_checks.join(", ")}
                        </p>
                      ) : null}
                    </div>
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
