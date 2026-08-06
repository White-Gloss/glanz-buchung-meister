import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowDown, ArrowUp, Eye, EyeOff, HelpCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listAllFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  reorderFaqs,
  type FaqRow,
  type FaqInput,
} from "@/lib/faqs.functions";
import { diagnoseBackendError } from "@/lib/backendErrors";
import { SupabaseConfigNotice } from "@/components/SupabaseConfigNotice";
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";

/**
 * FAQ-VERWALTUNG
 * ---------------
 * Die hier gepflegten Fragen erscheinen auf /faq und werden dort
 * automatisch als FAQPage-Schema für Googles Rich Results ausgezeichnet.
 * Einzelne FAQs lassen sich zusätzlich Ratgeber-Beiträgen zuordnen
 * (siehe /admin/blog).
 */

export const Route = createFileRoute("/_authenticated/_admin/admin/faqs")({
  head: () => ({
    meta: [
      { title: "FAQ-Verwaltung – White Gloss Detailing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FaqAdminRoute,
  errorComponent: ({ error }) => <SupabaseConfigNotice info={diagnoseBackendError(error)} />,
});

function FaqAdminRoute() {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return <SupabaseConfigNotice missing={config.missing} />;
  return <FaqAdminPage />;
}

/**
 * Vorschläge statt fester Auswahl: die Kategorien sind in der Datenbank
 * Freitext, damit neue Themen ohne Migration ergänzt werden können.
 */
const CATEGORY_SUGGESTIONS = [
  "Keramikversiegelung",
  "Innenraumreinigung",
  "Lackkorrektur",
  "Kosten",
  "Dauer",
  "Abholservice",
  "Allgemein",
];

const EMPTY_FAQ: FaqInput = {
  question: "",
  answer: "",
  category: "",
  sortOrder: 0,
  isPublished: true,
};

function FaqAdminPage() {
  const [faqs, setFaqs] = useState<FaqRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchAll = useServerFn(listAllFaqs);
  const reorder = useServerFn(reorderFaqs);

  const reload = useCallback(() => {
    setLoadError(null);
    void fetchAll({})
      .then(setFaqs)
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "FAQs konnten nicht geladen werden.");
      });
  }, [fetchAll]);

  useEffect(() => {
    let active = true;
    void fetchAll({})
      .then((rows) => {
        if (active) setFaqs(rows);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "FAQs konnten nicht geladen werden.");
      });
    return () => {
      active = false;
    };
  }, [fetchAll]);

  /**
   * Verschiebt einen Eintrag um eine Position und schickt die komplette
   * neue Reihenfolge zum Server. Die Liste wird sofort lokal umgestellt,
   * damit die Oberfläche nicht auf die Antwort warten muss.
   */
  async function move(index: number, direction: -1 | 1) {
    if (!faqs) return;
    const target = index + direction;
    if (target < 0 || target >= faqs.length) return;

    const next = [...faqs];
    [next[index], next[target]] = [next[target], next[index]];
    setFaqs(next.map((faq, position) => ({ ...faq, sort_order: position })));

    try {
      await reorder({ data: { orderedIds: next.map((faq) => faq.id) } });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Reihenfolge konnte nicht gespeichert werden.",
      );
      reload();
    }
  }

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
            <HelpCircle className="size-4 text-primary" />
            <h1 className="display-card text-sm uppercase">FAQ-Verwaltung</h1>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="glass mb-6 rounded-2xl p-5 text-sm leading-6 text-muted-foreground">
          <p>
            Diese Fragen erscheinen auf der{" "}
            <a href="/faq" className="text-primary underline underline-offset-2">
              FAQ-Seite
            </a>{" "}
            und werden für Google als FAQ-Rich-Result ausgezeichnet. Formulieren Sie Antworten
            vollständig und eigenständig verständlich — Google zeigt sie ohne den umgebenden Text
            an.
          </p>
        </div>

        {creating ? (
          <FaqForm
            title="Neue FAQ anlegen"
            initial={{ ...EMPTY_FAQ, sortOrder: faqs?.length ?? 0 }}
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              reload();
            }}
          />
        ) : (
          <Button className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Neue FAQ anlegen
          </Button>
        )}

        {loadError ? (
          <div className="glass mt-6 rounded-2xl border border-destructive/30 p-5 text-sm">
            <p className="text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              Erneut laden
            </Button>
          </div>
        ) : faqs === null ? (
          <p className="mt-6 text-sm text-muted-foreground">Wird geladen …</p>
        ) : faqs.length === 0 ? (
          <p className="glass mt-6 rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Noch keine FAQs angelegt.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {faqs.map((faq, index) => (
              <li key={faq.id}>
                {editingId === faq.id ? (
                  <FaqForm
                    title="FAQ bearbeiten"
                    id={faq.id}
                    initial={{
                      question: faq.question,
                      answer: faq.answer,
                      category: faq.category,
                      sortOrder: faq.sort_order,
                      isPublished: faq.is_published,
                    }}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      reload();
                    }}
                  />
                ) : (
                  <FaqCard
                    faq={faq}
                    isFirst={index === 0}
                    isLast={index === faqs.length - 1}
                    onEdit={() => setEditingId(faq.id)}
                    onMoveUp={() => void move(index, -1)}
                    onMoveDown={() => void move(index, 1)}
                    onChanged={reload}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function FaqCard({
  faq,
  isFirst,
  isLast,
  onEdit,
  onMoveUp,
  onMoveDown,
  onChanged,
}: {
  faq: FaqRow;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const remove = useServerFn(deleteFaq);
  const update = useServerFn(updateFaq);

  async function togglePublished() {
    setBusy(true);
    try {
      await update({
        data: {
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          sortOrder: faq.sort_order,
          isPublished: !faq.is_published,
        },
      });
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`„${faq.question}" wirklich endgültig löschen?`)) return;
    setBusy(true);
    try {
      await remove({ data: { id: faq.id } });
      toast.success("FAQ gelöscht.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {faq.category && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                {faq.category}
              </span>
            )}
            {!faq.is_published && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">
                Entwurf
              </span>
            )}
          </div>
          <h2 className="mt-2 text-sm font-medium text-foreground">{faq.question}</h2>
          <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {faq.answer}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onMoveUp}
              disabled={isFirst || busy}
              aria-label={`„${faq.question}" nach oben verschieben`}
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onMoveDown}
              disabled={isLast || busy}
              aria-label={`„${faq.question}" nach unten verschieben`}
            >
              <ArrowDown className="size-3.5" />
            </Button>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}>
              Bearbeiten
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={togglePublished}
              loading={busy}
              aria-label={faq.is_published ? "Als Entwurf speichern" : "Veröffentlichen"}
            >
              {faq.is_published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              loading={busy}
              aria-label={`„${faq.question}" löschen`}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqForm({
  title,
  id,
  initial,
  onCancel,
  onSaved,
}: {
  title: string;
  id?: string;
  initial: FaqInput;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FaqInput>(initial);
  const [saving, setSaving] = useState(false);
  const create = useServerFn(createFaq);
  const update = useServerFn(updateFaq);

  function set<K extends keyof FaqInput>(key: K, value: FaqInput[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (id) {
        await update({ data: { id, ...form } });
        toast.success("FAQ gespeichert.");
      } else {
        await create({ data: form });
        toast.success("FAQ angelegt.");
      }
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-5">
      <h2 className="display-card text-sm uppercase">{title}</h2>

      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Frage</span>
        <Input
          value={form.question}
          onChange={(event) => set("question", event.target.value)}
          placeholder="z. B. Wie lange hält eine Keramikversiegelung?"
          maxLength={300}
          required
          className="mt-1.5 bg-secondary/40"
        />
      </label>

      <label className="block">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Antwort</span>
        <Textarea
          value={form.answer}
          onChange={(event) => set("answer", event.target.value)}
          placeholder="Vollständige Antwort in zwei bis vier Sätzen …"
          maxLength={2000}
          required
          rows={5}
          className="mt-1.5 bg-secondary/40"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          {form.answer.length}/2000 Zeichen — Google zeigt die Antwort ohne den umgebenden Text an.
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Kategorie</span>
          <Input
            value={form.category}
            onChange={(event) => set("category", event.target.value)}
            list="faq-category-suggestions"
            placeholder="z. B. Keramikversiegelung"
            maxLength={80}
            className="mt-1.5 bg-secondary/40"
          />
          <datalist id="faq-category-suggestions">
            {CATEGORY_SUGGESTIONS.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>

        <label className="flex items-center gap-2.5 pt-6">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(event) => set("isPublished", event.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          <span className="text-sm text-foreground">Auf der Website sichtbar</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving}>
          Speichern
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
