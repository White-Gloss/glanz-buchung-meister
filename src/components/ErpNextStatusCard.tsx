import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/integrations/supabase/get-client";

type ProbeResult = {
  ok: boolean;
  status: number | null;
  count?: number;
  expected_found?: boolean;
};

type ErpNextHealth = {
  ok: boolean;
  authenticated?: boolean;
  permissions_ready?: boolean;
  upstream_status?: number;
  error?: string;
  checks?: {
    company: ProbeResult;
    customer_group: ProbeResult;
    territory: ProbeResult;
  };
};

function checkText(result: ProbeResult | undefined, expectedLabel: string) {
  if (!result) return "nicht geprüft";
  if (!result.ok)
    return result.status ? `kein Zugriff (HTTP ${result.status})` : "nicht erreichbar";
  if (result.expected_found === false) return `${expectedLabel} fehlt`;
  return "bereit";
}

/**
 * Read-only readiness test for the Supabase -> ERPNext bridge.
 * Credentials remain in Supabase Edge Function secrets and are never sent
 * to the browser. The browser only receives safe boolean/status information.
 */
export function ErpNextStatusCard() {
  const [status, setStatus] = useState<ErpNextHealth | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (notify: boolean) => {
    setChecking(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<ErpNextHealth>(
        "erpnext-healthcheck",
        {
          body: {},
        },
      );
      if (error) throw error;
      if (!data) throw new Error("ERPNext hat keine Statusantwort geliefert.");
      setStatus(data);
      if (notify) {
        if (data.ok && data.permissions_ready) toast.success("ERPNext-Verbindung ist bereit.");
        else if (data.ok) toast.warning("ERPNext ist erreichbar, aber Berechtigungen fehlen noch.");
        else toast.error("ERPNext-Verbindung ist noch nicht bereit.");
      }
    } catch (error) {
      setStatus({
        ok: false,
        error: error instanceof Error ? error.message : "healthcheck_failed",
      });
      if (notify) {
        toast.error(error instanceof Error ? error.message : "ERPNext-Test fehlgeschlagen.");
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check(false);
  }, [check]);

  const ready = Boolean(status?.ok && status?.authenticated && status?.permissions_ready);
  const reachable = Boolean(status?.ok && status?.authenticated);

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Database aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">ERPNext · WHITE GLOSS OS</h2>
            {ready ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">
                <CheckCircle2 aria-hidden className="size-3" />
                bereit
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-300">
                <AlertTriangle aria-hidden className="size-3" />
                {reachable ? "Berechtigungen prüfen" : "nicht verbunden"}
              </span>
            )}
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Der Test läuft ausschließlich serverseitig über Supabase. API-Key und API-Secret werden
            nicht an den Browser übertragen.
          </p>

          {status?.checks ? (
            <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Anmeldung</dt>
              <dd className="text-foreground/85">
                {status.authenticated ? "bereit" : "fehlgeschlagen"}
              </dd>
              <dt className="text-muted-foreground">Firma</dt>
              <dd className="text-foreground/85">
                {checkText(status.checks.company, "WHITE GLOSS")}
              </dd>
              <dt className="text-muted-foreground">Kundengruppe</dt>
              <dd className="text-foreground/85">
                {checkText(status.checks.customer_group, "Individual")}
              </dd>
              <dt className="text-muted-foreground">Gebiet</dt>
              <dd className="text-foreground/85">
                {checkText(status.checks.territory, "All Territories")}
              </dd>
            </dl>
          ) : status && !status.ok ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-300">
              Verbindungstest fehlgeschlagen. Prüfe zuerst API-Zugang und Rollen des technischen
              ERPNext-Benutzers.
            </p>
          ) : null}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          loading={checking}
          onClick={() => void check(true)}
        >
          {checking ? null : <RefreshCw aria-hidden className="size-4" />}
          Verbindung prüfen
        </Button>
      </div>
    </section>
  );
}
