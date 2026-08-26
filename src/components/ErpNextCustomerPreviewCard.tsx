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
    | "customer_and_contact_create_needed"
    | "reused_exact_email_contact"
    | "synced";
  production_write?: {
    enabled: boolean;
    booking_approved: boolean;
    ready: boolean;
    approval_id?: string | null;
    approval_expires_at?: string | null;
    approval_confirmation?: string | null;
    confirmation?: string | null;
  };
  error?: string;
};

type ApprovalResult = {
  ok: boolean;
  approval?: {
    id: string;
    scope: "customer";
    expires_at: string;
  };
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
    case "reused_exact_email_contact":
      return "Der eindeutige ERPNext-Kontakt wurde sicher der Buchung zugeordnet.";
    case "synced":
      return "Kunde und Kontakt wurden kontrolliert in ERPNext synchronisiert.";
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
    case "customer_write_gate_disabled":
      return "Der kontrollierte Kundensync ist serverseitig gesperrt.";
    case "customer_write_approval_required":
      return "Für diese Buchungsrevision fehlt eine aktive Einmalfreigabe.";
    case "approval_confirmation_invalid":
      return "Die Freigabebestätigung ist abgelaufen. Bitte die Vorschau neu laden.";
    case "explicit_customer_write_confirmation_required":
      return "Die buchungsgebundene Kundensync-Bestätigung fehlt oder ist nicht mehr gültig.";
    case "customer_sync_busy_blocked_or_revision_changed":
      return "Die Buchung wurde geändert oder wird bereits verarbeitet. Bitte die Vorschau neu laden.";
    case "customer_sync_lease_lost_before_write":
      return "Die sichere Verarbeitungssperre ist abgelaufen. Es wurde kein neuer ERPNext-Datensatz angelegt; bitte die Vorschau neu laden.";
    case "erpnext_auth_failed":
    case "erpnext_auth_unconfirmed":
      return "ERPNext-Anmeldung konnte für die Vorschau nicht bestätigt werden.";
    default:
      return code
        ? `Vorschau abgebrochen: ${code}`
        : "Die Vorschau konnte nicht ausgeführt werden.";
  }
}

export function ErpNextCustomerPreviewCard() {
  const [bookings, setBookings] = useState<EligibleBooking[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [committing, setCommitting] = useState(false);
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
      const message =
        error instanceof Error ? error.message : "Kundensync-Vorschau fehlgeschlagen.";
      setResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setPreviewing(false);
    }
  }, [selectedId]);

  const runApproval = useCallback(async () => {
    const confirmation = result?.production_write?.approval_confirmation;
    if (
      !selectedId ||
      !result?.ok ||
      result.mode !== "preview" ||
      !result.production_write?.enabled ||
      result.production_write.ready ||
      !confirmation ||
      result.customer_state === "already_synced"
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Einmalige ERPNext-Kundenfreigabe erteilen? Sie gilt höchstens fünf Minuten, nur für diese Buchungsrevision und wird beim ersten sicheren Sync-Versuch verbraucht.",
    );
    if (!confirmed) return;

    setApproving(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<ApprovalResult>(
        "erpnext-write-approval",
        {
          body: {
            bookingId: selectedId,
            scope: "customer",
            confirmation,
          },
        },
      );
      if (error) throw error;
      if (!data?.ok || !data.approval) throw new Error(errorText(data?.error));

      toast.success("Einmalfreigabe erteilt. Die Vorschau wird revisionsgenau erneuert.");
      await runPreview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Einmalfreigabe fehlgeschlagen.");
    } finally {
      setApproving(false);
    }
  }, [result, runPreview, selectedId]);

  const runCommit = useCallback(async () => {
    const confirmation = result?.production_write?.confirmation;
    const approvalId = result?.production_write?.approval_id;
    if (
      !selectedId ||
      !result?.ok ||
      result.mode !== "preview" ||
      !result.production_write?.ready ||
      !approvalId ||
      !confirmation ||
      result.customer_state === "already_synced"
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Kontrollierten ERPNext-Kundensync starten? Je nach Vorschau wird ein Kunde und Kontakt angelegt oder ein vorhandener eindeutiger Kontakt wiederverwendet. Fahrzeug, Auftrag und Finanzdaten bleiben unberührt.",
    );
    if (!confirmed) return;

    setCommitting(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<PreviewResult>(
        "erpnext-sync-customer",
        {
          body: {
            bookingId: selectedId,
            mode: "commit",
            approvalId,
            confirmation,
          },
        },
      );

      if (error) throw error;
      if (!data) throw new Error("ERPNext hat keine Kundensync-Antwort geliefert.");
      setResult(data);
      if (data.ok) {
        toast.success(
          data.customer_state === "reused_exact_email_contact"
            ? "Bestehender ERPNext-Kontakt wurde eindeutig zugeordnet."
            : "Kunde und Kontakt wurden kontrolliert synchronisiert.",
        );
      } else {
        toast.warning(errorText(data.error));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kontrollierter Kundensync fehlgeschlagen.";
      setResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setCommitting(false);
    }
  }, [result, selectedId]);

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Eye aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">Kundensync · Vorschau & Gate</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300">
              <ShieldCheck aria-hidden className="size-3" />
              ohne Schreibzugriff
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prüft für eine bestätigte oder bezahlte Buchung, ob in ERPNext bereits ein eindeutiger
            Kontakt existiert und welche Datensätze angelegt werden müssten. Nur eine frische,
            serverseitig signierte Vorschau für die exakt freigegebene Buchung kann anschließend den
            kontrollierten Kundensync öffnen.
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
                disabled={loadingBookings || bookings.length === 0 || approving || committing}
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
                disabled={approving || committing}
                onClick={() => void loadBookings()}
              >
                {loadingBookings ? null : <RefreshCw aria-hidden className="size-4" />}
                Aktualisieren
              </Button>
              <Button
                type="button"
                size="sm"
                loading={previewing}
                disabled={!selectedId || approving || committing}
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
                {result.ok ? (
                  <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" />
                )}
                <div>
                  <p>{result.ok ? stateText(result.customer_state) : errorText(result.error)}</p>
                  {result.ok ? (
                    <p className="mt-1 text-xs opacity-80">
                      {result.mode === "preview"
                        ? `Produktions-Gate: ${
                            result.production_write?.ready
                              ? "für diese Buchung freigegeben"
                              : "gesperrt"
                          }.`
                        : "Kundensync abgeschlossen; Gate wird für den nächsten Lauf neu geprüft."}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {result?.ok &&
          result.mode === "preview" &&
          result.customer_state !== "already_synced" &&
          !result.production_write?.ready ? (
            <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100">
              <div className="flex items-start gap-2">
                <ShieldCheck aria-hidden className="mt-1 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Kundensync technisch gesperrt</p>
                  <p className="mt-1 text-xs opacity-90">
                    {result.production_write?.enabled
                      ? "Die Vorschau ist sicher. Erteilen Sie eine kurzlebige Einmalfreigabe für genau diese Buchungsrevision."
                      : "Die Vorschau ist sicher. Der globale serverseitige Schreibschalter ist weiterhin deaktiviert."}
                  </p>
                  {result.production_write?.enabled &&
                  result.production_write.approval_confirmation ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      loading={approving}
                      disabled={previewing || committing}
                      onClick={() => void runApproval()}
                    >
                      {approving ? null : <ShieldCheck aria-hidden className="size-4" />}
                      Einmalig freigeben
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {result?.ok &&
          result.mode === "preview" &&
          result.customer_state !== "already_synced" &&
          result.production_write?.ready &&
          result.production_write.confirmation ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              <div className="flex items-start gap-2">
                <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Kontrollierter Kundensync</p>
                  <p className="mt-1 text-xs opacity-90">
                    Verarbeitet ausschließlich den Kunden und Kontakt dieser Buchungsrevision.
                    Fahrzeug, Auftrag, Rechnung, Zahlung und Buchhaltung bleiben unberührt.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3"
                    loading={committing}
                    disabled={previewing || approving}
                    onClick={() => void runCommit()}
                  >
                    {committing ? null : <ShieldCheck aria-hidden className="size-4" />}
                    Kunde & Kontakt synchronisieren
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
