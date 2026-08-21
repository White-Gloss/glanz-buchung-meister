import { useCallback, useState } from "react";
import { CarFront, CheckCircle2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/integrations/supabase/get-client";

type PermissionProbe = {
  ok: boolean;
  status: number | null;
  allowed?: boolean;
};

type ResourceProbe = {
  ok: boolean;
  status: number | null;
  readable: boolean;
  exists: boolean | null;
};

type ModelProbe = {
  doctype: string;
  resource: ResourceProbe;
  permissions: {
    create: PermissionProbe;
    write: PermissionProbe;
  };
  ready: boolean;
};

type ReadinessResult = {
  ok: boolean;
  mode?: "preview";
  writes_performed?: boolean;
  model_ready?: boolean;
  standard_erpnext_vehicle_used?: boolean;
  vehicle?: ModelProbe;
  order?: ModelProbe;
  error?: string;
};

function resourceText(probe: ResourceProbe | undefined) {
  if (!probe?.ok) return "Prüfung fehlgeschlagen";
  if (probe.exists === false) return "fehlt";
  if (probe.exists === null) return probe.status === 403 ? "kein Lesezugriff" : "unklar";
  return probe.readable ? "vorhanden" : "nicht lesbar";
}

function permissionText(probe: PermissionProbe | undefined) {
  if (!probe?.ok) return "nicht geprüft";
  return probe.allowed ? "erlaubt" : "nicht erlaubt";
}

export function ErpNextVehicleOrderReadinessCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReadinessResult | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<ReadinessResult>(
        "erpnext-vehicle-order-readiness",
        { body: {} },
      );
      if (error) throw error;
      if (!data) throw new Error("ERPNext hat keine Modellantwort geliefert.");
      setResult(data);
      if (data.ok && data.model_ready) {
        toast.success("Fahrzeug- und Auftragsmodell sind bereit.");
      } else if (data.ok) {
        toast.warning("Fahrzeug- und Auftragsmodell sind noch nicht vollständig bereit.");
      } else {
        toast.warning(data.error ?? "Modellprüfung konnte nicht abgeschlossen werden.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fahrzeug-/Auftragsmodell-Prüfung fehlgeschlagen.";
      setResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const modelMissing =
    result?.ok === true &&
    (result.vehicle?.resource.exists === false || result.order?.resource.exists === false);

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CarFront aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">Fahrzeug & Auftrag · Gate 5</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300">
              <ShieldCheck aria-hidden className="size-3" />
              nur Modellprüfung
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prüft, ob die vorgesehenen WHITE-GLOSS-DocTypes für Kundenfahrzeuge und operative
            Aufträge vorhanden und für den technischen Benutzer nutzbar sind. Das Standard-ERPNext-
            Fahrzeugmodell wird bewusst nicht verwendet. Es werden keine Daten angelegt oder
            verändert.
          </p>

          <div className="mt-4">
            <Button type="button" size="sm" loading={loading} onClick={() => void runCheck()}>
              {loading ? null : <RefreshCw aria-hidden className="size-4" />}
              Modell prüfen
            </Button>
          </div>

          {result ? (
            <div
              className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${
                result.ok && result.model_ready
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              <div className="flex items-start gap-2">
                {result.ok && result.model_ready ? (
                  <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" />
                )}
                <div className="min-w-0 space-y-2">
                  {result.ok ? (
                    <>
                      <div>
                        <p className="font-medium">
                          {result.vehicle?.doctype ?? "WHITE GLOSS Vehicle"}
                        </p>
                        <p className="text-xs opacity-80">
                          Status: {resourceText(result.vehicle?.resource)} · Anlegen:{" "}
                          {permissionText(result.vehicle?.permissions.create)} · Ändern:{" "}
                          {permissionText(result.vehicle?.permissions.write)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">
                          {result.order?.doctype ?? "WHITE GLOSS Order"}
                        </p>
                        <p className="text-xs opacity-80">
                          Status: {resourceText(result.order?.resource)} · Anlegen:{" "}
                          {permissionText(result.order?.permissions.create)} · Ändern:{" "}
                          {permissionText(result.order?.permissions.write)}
                        </p>
                      </div>
                      {modelMissing ? (
                        <p className="pt-1 text-xs opacity-80">
                          Das Custom-Modell ist noch nicht installiert. Nächster Schritt ist die
                          saubere Frappe-App-/Private-Bench-Bereitstellung; keine Zwischenlösung mit
                          dem Standard-Fuhrparkmodell.
                        </p>
                      ) : null}
                      <p className="text-xs opacity-80">Schreibvorgänge: keine.</p>
                    </>
                  ) : (
                    <p>Prüfung abgebrochen: {result.error ?? "unbekannter Fehler"}</p>
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
