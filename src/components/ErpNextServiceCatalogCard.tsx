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
  is_stock_item?: boolean;
  item_group?: string;
  stock_uom?: string;
};

type CatalogResult = {
  ok: boolean;
  mode?: "preview" | "commit";
  writes_performed?: boolean;
  catalog_ready?: boolean;
  write_ready?: boolean;
  existing_count?: number;
  expected_count?: number;
  missing_codes?: string[];
  invalid_codes?: string[];
  created_codes?: string[];
  reused_codes?: string[];
  prerequisites?: {
    item_group: string;
    item_group_ready: boolean;
    stock_uom: string;
    stock_uom_ready: boolean;
  };
  item_permissions?: {
    create: PermissionProbe;
    write: PermissionProbe;
  };
  items?: CatalogItem[];
  error?: string;
};

const WRITE_CONFIRMATION = "CREATE_WHITE_GLOSS_SERVICE_CATALOG_V1";

function permissionText(probe: PermissionProbe | undefined) {
  if (!probe?.ok) return "nicht geprüft";
  return probe.allowed ? "erlaubt" : "nicht erlaubt";
}

export function ErpNextServiceCatalogCard() {
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [result, setResult] = useState<CatalogResult | null>(null);

  const invokeCatalog = useCallback(async (mode: "preview" | "commit") => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.functions.invoke<CatalogResult>(
      "erpnext-service-catalog",
      {
        body: mode === "commit" ? { mode, confirmation: WRITE_CONFIRMATION } : { mode },
      },
    );
    if (error) throw error;
    if (!data) throw new Error("ERPNext hat keine Katalogantwort geliefert.");
    return data;
  }, []);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await invokeCatalog("preview");
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
  }, [invokeCatalog]);

  const runWrite = useCallback(async () => {
    setWriting(true);
    try {
      const data = await invokeCatalog("commit");
      setResult(data);
      if (data.ok && data.catalog_ready) {
        toast.success("WHITE-GLOSS-Service-Katalog wurde in ERPNext verifiziert.");
      } else {
        toast.warning(data.error ?? "Service-Katalog konnte nicht angelegt werden.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Service-Katalog-Schreibvorgang fehlgeschlagen.";
      toast.error(message);
    } finally {
      setWriting(false);
    }
  }, [invokeCatalog]);

  const missing = result?.missing_codes ?? [];
  const invalid = result?.invalid_codes ?? [];
  const canWrite =
    result?.ok === true &&
    result.write_ready === true &&
    result.catalog_ready !== true &&
    invalid.length === 0;

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Boxes aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">Service-Katalog · Gate 4</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300">
              <ShieldCheck aria-hidden className="size-3" />
              kontrollierter Schreib-Gate
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prüft die fest definierten WHITE-GLOSS-Paket-, Zusatzleistungs- und Abholservice-Codes
            direkt in ERPNext. Ein Schreibvorgang kann ausschließlich die fest hinterlegten
            Service-Artikel erzeugen; Preise, Rechnungen, Zahlungen und Buchhaltung bleiben
            unberührt.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" size="sm" loading={loading} onClick={() => void runCheck()}>
              {loading ? null : <RefreshCw aria-hidden className="size-4" />}
              Katalog prüfen
            </Button>
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={writing}
                onClick={() => void runWrite()}
              >
                12 Service-Artikel anlegen
              </Button>
            ) : null}
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
                      {result.prerequisites ? (
                        <p className="mt-1 text-xs opacity-80">
                          Item-Gruppe {result.prerequisites.item_group}:{" "}
                          {result.prerequisites.item_group_ready ? "bereit" : "fehlt"} · UOM{" "}
                          {result.prerequisites.stock_uom}:{" "}
                          {result.prerequisites.stock_uom_ready ? "bereit" : "fehlt"}
                        </p>
                      ) : null}
                      {missing.length > 0 ? (
                        <p className="mt-2 break-words text-xs">Fehlend: {missing.join(", ")}</p>
                      ) : null}
                      {invalid.length > 0 ? (
                        <p className="mt-2 break-words text-xs">Prüfen: {invalid.join(", ")}</p>
                      ) : null}
                      {result.created_codes?.length ? (
                        <p className="mt-2 break-words text-xs">
                          Neu angelegt: {result.created_codes.join(", ")}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs opacity-80">
                        Schreibvorgänge: {result.writes_performed ? "ausgeführt" : "keine"}.
                      </p>
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
