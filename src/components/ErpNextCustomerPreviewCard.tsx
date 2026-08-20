import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/integrations/supabase/get-client";

type EligibleBooking = {
  id: string;
  booking_date: string;
  customer_name: string;
  status: string;
};

type PreviewResult = {
  ok: boolean;
  mode?: "preview" | "commit";
  booking_id?: string;
  writes_enabled?: boolean;
  customer_state?:
    | "already_synced"
    | "existing_mapping_and_contact"
    | "existing_exact_email_contact"
    | "contact_create_needed"
    | "customer_and_contact_create_needed";
  error?: string;
};

function stateText(state: PreviewResult["customer_state"]) {
  switch (state) {
    case "already_synced":
      return "Kunde und Kontakt sind bereits sauber synchronisiert.";
    case "existing_mapping_and_contact":
      return "Vorhandene Zuordnung und vorhandener ERPNext-Kontakt passen zusammen.";
    case "existing_exact_email_contact":
      return "Ein eindeutiger ERPNext-Kontakt mit exakt derselben E-Mail wurde gefunden.";
    case "contact_create_needed":
      return "Der ERPNext-Kunde ist bereits zugeordnet; nur der Kontakt müsste angelegt werden.";
    case "customer_and_contact_create_needed":
      return "Für diese Buchung müssten ein ERPNext-Kunde und ein Kontakt angelegt werden.";
    default:
      return "Vorschau abgeschlossen.";
  }
}

function errorText(code: string | undefined) {
  switch (code) {
    case "multiple_exact_email_contacts":
      return "Mehrere ERPNext-Kontakte verwenden exakt diese E-Mail. Manuelle Prüfung erforderlich.";
    case "email_contact_without_customer_link":
      return "Der gefundene ERPNext-Kontakt ist keinem Kunden eindeutig zugeordnet.";
    case "email_contact_has_multiple_customer_links":
      return "Der gefundene ERPNext-Kontakt ist mehreren Kunden zugeordnet.";
    case "customer_mapping_conflict":
      return "Die gespeicherte Kundenzuordnung widerspricht dem gefundenen ERPNext-Kontakt.";
    case "customer_mapping_requires_manual_review":
      return "Diese Kundenzuordnung ist wegen eines früheren unsicheren Fehlers für automatische Verarbeitung gesperrt.";
    case "erpnext_auth_failed":
    case "erpnext_auth_unconfirmed":
      return "ERPNext-Anmeldung konnte für die Vorschau nicht bestätigt werden.";
    default:
      return code ? `Vorschau abgebrochen: ${code}` : "Die Vorschau konnte nicht ausgeführt werden.";
  }
}

export function ErpNextCustomerPreviewCard() {
  const [bookings, setBookings] = useState<EligibleBooking[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_date, customer_name, status")
        .in("status", ["Bestätigt", "Bezahlt"])
        .order("booking_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      const next = (data ?? []) as EligibleBooking[];
      setBookings(next);
      setSelectedId((current) => {
        if (current && next.some((booking) => booking.id === current)) return current;
        return next[0]?.id ?? "";
      });
      setResult(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Buchungen konnten nicht geladen werden.");
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
        "erpnext-sync-customer",
        {
          body: { bookingId: selectedId, mode: "preview" },
        },
      );

      if (error) throw error;
      if (!data) throw new Error("ERPNext hat keine Vorschauantwort geliefert.");
      setResult(data);
      if (data.ok) {
        toast.success("Kundensync-Vorschau abgeschlossen. Es wurde nichts geschrieben.");
      } else {
        toast.warning(errorText(data.error));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kundensync-Vorschau fehlgeschlagen.";
      setResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setPreviewing(false);
    }
  }, [selectedId]);

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Eye aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">Kundensync · Vorschau</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300">
              <ShieldCheck aria-hidden className="size-3" />
              ohne Schreibzugriff
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prüft für eine bestätigte oder bezahlte Buchung, ob in ERPNext bereits ein eindeutiger
            Kontakt existiert und welche Datensätze später angelegt werden müssten. Diese Vorschau
            legt nichts an und ändert nichts.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1.5 block text-muted-foreground">Buchung auswählen</span>
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setResult(null);
                }}
                disabled={loadingBookings || bookings.length === 0}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                {bookings.length === 0 ? (
                  <option value="">Keine bestätigte/bezahlte Buchung gefunden</option>
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
                onClick={() => void loadBookings()}
              >
                {loadingBookings ? null : <RefreshCw aria-hidden className="size-4" />}
                Aktualisieren
              </Button>
              <Button
                type="button"
                size="sm"
                loading={previewing}
                disabled={!selectedId}
                onClick={() => void runPreview()}
              >
                {previewing ? null : <Eye aria-hidden className="size-4" />}
                Vorschau prüfen
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
                {result.ok ? <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0" /> : null}
                <div>
                  <p>{result.ok ? stateText(result.customer_state) : errorText(result.error)}</p>
                  {result.ok ? (
                    <p className="mt-1 text-xs opacity-80">
                      Produktions-Schreibschalter: {result.writes_enabled ? "aktiv" : "weiterhin aus"}.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
