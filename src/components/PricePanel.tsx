import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Save, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateServicePrice } from "@/lib/pricing.functions";
import { currency, currentPriceRows, type ServicePriceRow } from "@/lib/servicesConfig";

const groups: { type: ServicePriceRow["item_type"]; title: string; hint: string }[] = [
  { type: "package", title: "Pakete (Grundpreis)", hint: "Bruttopreis für die Kompaktklasse" },
  { type: "addon", title: "Zusatzleistungen", hint: "Bruttopreis, Abholservice ist pauschal" },
  { type: "vehicle", title: "Fahrzeugfaktoren", hint: "Multiplikator auf Paket- und Add-on-Preise" },
];

export function PricePanel() {
  const [rows, setRows] = useState<ServicePriceRow[]>(() => currentPriceRows());
  const [saving, setSaving] = useState<string | null>(null);
  const save = useServerFn(updateServicePrice);

  function setAmount(type: string, id: string, value: string) {
    const amount = Number(value.replace(",", "."));
    setRows((list) =>
      list.map((r) =>
        r.item_type === type && r.item_id === id ? { ...r, amount: Number.isFinite(amount) ? amount : 0 } : r,
      ),
    );
  }

  async function persist(row: ServicePriceRow) {
    const key = `${row.item_type}:${row.item_id}`;
    setSaving(key);
    try {
      await save({ data: { itemType: row.item_type, itemId: row.item_id, amount: row.amount } });
      toast.success(`${row.label} gespeichert`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="glass mt-8 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Tag className="size-5 text-primary" />
        <div>
          <h2 className="display-sub text-lg">Preise verwalten</h2>
          <p className="text-sm text-muted-foreground">
            Änderungen gelten sofort für Website, Buchungstool und neue Rechnungen.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.type} className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
            <p className="label-caps text-sm">{group.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{group.hint}</p>
            <div className="mt-4 space-y-3">
              {rows
                .filter((r) => r.item_type === group.type)
                .map((row) => {
                  const key = `${row.item_type}:${row.item_id}`;
                  return (
                    <div key={key} className="grid grid-cols-[minmax(0,1fr)_92px_auto] items-center gap-2">
                      <label htmlFor={key} className="truncate text-sm" title={row.label}>
                        {row.label}
                      </label>
                      <Input
                        id={key}
                        inputMode="decimal"
                        className="h-9 text-right tabular-nums"
                        value={String(row.amount)}
                        onChange={(e) => setAmount(row.item_type, row.item_id, e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9"
                        disabled={saving === key}
                        onClick={() => persist(row)}
                        aria-label={`${row.label} speichern`}
                      >
                        <Save className="size-4" />
                      </Button>
                    </div>
                  );
                })}
            </div>
            {group.type !== "vehicle" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Beispiel Kompaktklasse:{" "}
                {currency(rows.find((r) => r.item_type === group.type)?.amount ?? 0)}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Hinweis: Bereits gespeicherte Buchungen behalten ihren ursprünglichen Betrag.
      </p>
    </section>
  );
}
