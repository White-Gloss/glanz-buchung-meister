import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, EyeOff, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listAllCustomServices,
  createCustomService,
  updateCustomService,
  deleteCustomService,
  type CustomServiceRow,
  type CustomServiceInput,
} from "@/lib/customServices.functions";
import { servicePackages } from "@/lib/servicesConfig";
import { diagnoseBackendError } from "@/lib/backendErrors";
import { SupabaseConfigNotice } from "@/components/SupabaseConfigNotice";
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";

export const Route = createFileRoute("/_authenticated/_admin/admin/leistungen")({
  head: () => ({
    meta: [
      { title: "Eigene Leistungen – White Gloss Detailing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomServicesRoute,
  errorComponent: ({ error }) => <SupabaseConfigNotice info={diagnoseBackendError(error)} />,
});

function CustomServicesRoute() {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return <SupabaseConfigNotice missing={config.missing} />;
  return <CustomServicesPage />;
}

const EMPTY_FORM: CustomServiceInput = {
  slug: "",
  name: "",
  shortName: "",
  eyebrow: "",
  lead: "",
  detail: "",
  benefits: ["", "", "", ""],
  metaTitle: "",
  metaDescription: "",
  relatedPackageIds: [],
  isPublished: true,
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CustomServicesPage() {
  const [rows, setRows] = useState<CustomServiceRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomServiceRow | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchAll = useServerFn(listAllCustomServices);

  function reload() {
    setLoadError(null);
    void fetchAll({})
      .then(setRows)
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Leistungen konnten nicht geladen werden.",
        );
      });
  }
  useEffect(() => {
    let active = true;
    void fetchAll({})
      .then((nextRows) => {
        if (active) setRows(nextRows);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Leistungen konnten nicht geladen werden.",
        );
      });
    return () => {
      active = false;
    };
  }, [fetchAll]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/admin">
              <ArrowLeft className="size-4" />
              Zurück
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h1 className="display-card text-sm uppercase">Eigene Leistungen</h1>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="glass mb-6 rounded-2xl p-5 text-sm leading-6 text-muted-foreground">
          <p>
            Diese Liste ergänzt die 7 fest hinterlegten Kern-Leistungen um eigene Angebote. Jede
            eigene Leistung bekommt eine eigene Seite unter <code>/leistungen/[url-kurzform]</code>{" "}
            und erscheint in der Leistungsübersicht.
          </p>
          <p className="mt-2">
            <strong>Ein Unterschied zu den Kern-Leistungen:</strong> Für die 7 Kern-Leistungen gibt
            es zusätzlich 91 einzelne Seiten je Stadt, mit handgeschriebenen Texten. Das gibt es für
            eigene Leistungen bewusst nicht — automatisch erzeugter Text ohne echten Unterschied je
            Stadt würde von Google als doppelter Inhalt gewertet.
          </p>
        </div>

        {!creating && !editing && (
          <Button onClick={() => setCreating(true)} className="mb-6 gap-1.5">
            <Plus className="size-4" />
            Neue Leistung anlegen
          </Button>
        )}

        {(creating || editing) && (
          <ServiceForm
            key={editing?.id ?? "new-service"}
            initial={editing ?? undefined}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={() => {
              setCreating(false);
              setEditing(null);
              reload();
            }}
          />
        )}

        {loadError ? (
          <div className="glass rounded-2xl border border-destructive/30 p-5 text-sm">
            <p className="text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              Erneut laden
            </Button>
          </div>
        ) : rows === null ? (
          <p className="text-sm text-muted-foreground">Wird geladen …</p>
        ) : rows.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Noch keine eigenen Leistungen angelegt.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <ServiceRow
                key={row.id}
                row={row}
                onEdit={() => {
                  setCreating(false);
                  setEditing(row);
                }}
                onDeleted={reload}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ServiceRow({
  row,
  onEdit,
  onDeleted,
}: {
  row: CustomServiceRow;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const remove = useServerFn(deleteCustomService);

  async function handleDelete() {
    if (
      !window.confirm(
        `„${row.name}“ wirklich endgültig löschen? Die Seite /leistungen/${row.slug} verschwindet danach sofort.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await remove({ data: { id: row.id } });
      toast.success("Leistung gelöscht.");
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="glass flex items-center justify-between gap-4 rounded-2xl p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          {row.is_published ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              <Eye className="size-3" />
              live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              <EyeOff className="size-3" />
              Entwurf
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">/leistungen/{row.slug}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
          <Pencil className="size-3.5" />
          Bearbeiten
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          loading={deleting}
          aria-label={`${row.name} löschen`}
          className="gap-1.5 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

function ServiceForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: CustomServiceRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CustomServiceInput>(() =>
    initial
      ? {
          slug: initial.slug,
          name: initial.name,
          shortName: initial.short_name,
          eyebrow: initial.eyebrow,
          lead: initial.lead,
          detail: initial.detail,
          benefits:
            initial.benefits.length > 0
              ? Array.from({ length: 4 }, (_, index) => initial.benefits[index] ?? "")
              : [...EMPTY_FORM.benefits],
          metaTitle: initial.meta_title,
          metaDescription: initial.meta_description,
          relatedPackageIds: initial.related_package_ids,
          isPublished: initial.is_published,
        }
      : { ...EMPTY_FORM, benefits: [...EMPTY_FORM.benefits] },
  );
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [saving, setSaving] = useState(false);

  const create = useServerFn(createCustomService);
  const update = useServerFn(updateCustomService);

  function updateField<K extends keyof CustomServiceInput>(key: K, value: CustomServiceInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleNameChange(value: string) {
    updateField("name", value);
    if (!slugTouched) updateField("slug", slugify(value));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.slug.trim() || !form.lead.trim()) {
      toast.error("Name, URL-Kurzform und Kurzbeschreibung sind Pflichtfelder.");
      return;
    }
    setSaving(true);
    try {
      const payload: CustomServiceInput = {
        ...form,
        shortName: form.shortName.trim() || form.name.trim(),
        benefits: form.benefits.map((b) => b.trim()).filter(Boolean),
      };
      if (initial) {
        await update({ data: { id: initial.id, ...payload } });
        toast.success("Leistung aktualisiert.");
      } else {
        await create({ data: payload });
        toast.success("Leistung angelegt.");
      }
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="glass mb-6 space-y-5 rounded-2xl p-5" onSubmit={handleSubmit}>
      <h2 className="display-card text-sm uppercase">
        {initial ? "Leistung bearbeiten" : "Neue Leistung"}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Für eine neue Leistung reichen Name und Kurzbeschreibung. Alle weiteren Angaben sind
        optional und können später ergänzt werden.
      </p>

      <LabeledInput
        label="Name"
        value={form.name}
        onChange={handleNameChange}
        placeholder="z. B. Cabrio-Verdeckpflege"
        maxLength={100}
        required
      />

      <LabeledTextarea
        label="Kurzbeschreibung"
        value={form.lead}
        onChange={(v) => updateField("lead", v)}
        rows={2}
        maxLength={320}
        required
      />

      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Weitere Angaben und SEO (optional)
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledInput
              label="URL-Kurzform"
              value={form.slug}
              onChange={(v) => {
                setSlugTouched(true);
                updateField("slug", slugify(v));
              }}
              placeholder="cabrio-verdeckpflege"
              hint={`whitegloss.de/leistungen/${form.slug || "…"}`}
              maxLength={60}
            />
            <LabeledInput
              label="Kurzform für Buttons"
              value={form.shortName}
              onChange={(v) => updateField("shortName", v)}
              placeholder="z. B. Verdeckpflege"
              maxLength={80}
            />
            <LabeledInput
              label="Kategorie-Text"
              value={form.eyebrow}
              onChange={(v) => updateField("eyebrow", v)}
              placeholder="z. B. Schutz für Cabrioverdecke"
              maxLength={120}
            />
          </div>

          <LabeledTextarea
            label="Ausführlicher Text für die Detailseite"
            value={form.detail}
            onChange={(v) => updateField("detail", v)}
            rows={3}
            maxLength={2500}
          />

          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Vorteile (bis zu 4)
            </p>
            <div className="mt-2 space-y-2">
              {form.benefits.map((benefit, index) => (
                <Input
                  key={index}
                  value={benefit}
                  maxLength={180}
                  aria-label={`Vorteil ${index + 1}`}
                  onChange={(event) => {
                    const next = [...form.benefits];
                    next[index] = event.target.value;
                    updateField("benefits", next);
                  }}
                  placeholder={`Vorteil ${index + 1}`}
                  className="bg-secondary/40"
                />
              ))}
            </div>
          </div>

          <fieldset>
            <legend className="text-xs uppercase tracking-widest text-muted-foreground">
              Passende Pakete
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {servicePackages.map((pkg) => {
                const active = form.relatedPackageIds.includes(pkg.id);
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      updateField(
                        "relatedPackageIds",
                        active
                          ? form.relatedPackageIds.filter((id) => id !== pkg.id)
                          : [...form.relatedPackageIds, pkg.id],
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {pkg.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <LabeledInput
            label="Meta-Titel (max. ca. 60 Zeichen)"
            value={form.metaTitle}
            onChange={(v) => updateField("metaTitle", v)}
            maxLength={70}
          />
          <LabeledTextarea
            label="Meta-Beschreibung (max. ca. 155 Zeichen)"
            value={form.metaDescription}
            onChange={(v) => updateField("metaDescription", v)}
            rows={2}
            maxLength={180}
          />
        </div>
      </details>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={form.isPublished}
          onChange={(e) => updateField("isPublished", e.target.checked)}
          className="size-4 rounded border-border"
        />
        Sofort veröffentlichen (sonst als Entwurf speichern, nur im Admin sichtbar)
      </label>

      <div className="flex gap-3 border-t border-border pt-4">
        <Button type="submit" loading={saving}>
          {initial ? "Änderungen speichern" : "Leistung anlegen"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="mt-1.5 bg-secondary/40"
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  rows,
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-border bg-secondary/40 p-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}
