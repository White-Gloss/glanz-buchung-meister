import { useCallback, useState } from "react";
import { Boxes, CheckCircle2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/integrations/supabase/get-client";

type PermissionProbe = {
  ok: boolean;
  status: number | null;
  allowed?: boolean;
};

type CatalogItem = {
  code: string;
  label: string;
  kind: "package" | "addon" | "pickup";
  present: boolean;
  disabled?: boolean;
  is_sales_item?: boolean;
};

type CatalogResult = {
  ok: boolean;
  mode?: "preview";
  writes_performed?: boolean;
  catalog_ready?: boolean;
  existing_count?: number;
  expected_count?: number;
  missing_codes?: string[];
  invalid_codes?: string[];
  item_permissions?: {
    create: PermissionProbe;
    write: PermissionProbe;
  };
  items?: CatalogItem[];
  error?: string;
};

function permissionText(probe: PermissionProbe | undefined) {
  if (!probe?.ok) return "nicht geprüft";
  return probe.allowed ? "erlaubt" : "nicht erlaubt";
}

export function ErpNextServiceCatalogCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CatalogResult | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<CatalogResult>(
        "erpnext-service-catalog",
        { body: {} },
      );
      if (error) throw error;
      if (!data) throw new Error("ERPNext hat keine Katalogantwort geliefert.");
      setResult(data);
      if (data.ok) {
        toast.success("Service-Katalog geprüft. Es wurde nichts geschrieben.");
      } else {
        toast.warning(data.error ?? "Service-Katalog konnte nicht geprüft werden.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Service-Katalog-Prüfung fehlgeschlagen.";
      setResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const missing = result?.missing_codes ?? [];
  const invalid = result?.invalid_codes ?? [];

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Boxes aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">Service-Katalog · Gate 4</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300">
              <ShieldCheck aria-hidden className="size-3" />
              nur Prüfung
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prüft die fest definierten WHITE-GLOSS-Paket-, Zusatzleistungs- und Abholservice-Codes
            direkt in ERPNext sowie die Item-Berechtigungen des technischen Benutzers. Es werden
            keine Artikel angelegt oder verändert.
          </p>

          <div className="mt-4">
            <Button type="button" size="sm" loading={loading} onClick={() => void runCheck()}>
              {loading ? null : <RefreshCw aria-hidden className="size-4" />}
              Katalog prüfen
            </Button>
          </div>

          {result ? (
            <div
              className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${
                result.ok && result.catalog_ready
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              <div className="flex items-start gap-2">
                {result.ok && result.catalog_ready ? (
                  <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0" />
                )}
                <div className="min-w-0">
                  {result.ok ? (
                    <>
                      <p>
                        ERPNext-Katalog: {result.existing_count ?? 0}/{result.expected_count ?? 0}{" "}
                        definierte Codes vorhanden.
                      </p>
                      <p className="mt-1 text-xs opacity-80">
                        Item anlegen: {permissionText(result.item_permissions?.create)} · Item
                        ändern: {permissionText(result.item_permissions?.write)}
                      </p>
                      {missing.length > 0 ? (
                        <p className="mt-2 break-words text-xs">Fehlend: {missing.join(", ")}</p>
                      ) : null}
                      {invalid.length > 0 ? (
                        <p className="mt-2 break-words text-xs">Prüfen: {invalid.join(", ")}</p>
                      ) : null}
                      <p className="mt-2 text-xs opacity-80">Schreibvorgänge: keine.</p>
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
