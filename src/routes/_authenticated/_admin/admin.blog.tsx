import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileText, ImageIcon, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listAllBlogPosts,
  getBlogPostForEdit,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  uploadBlogImage,
  type BlogPostInput,
  type BlogPostSummary,
} from "@/lib/blog.functions";
import { listAllFaqs, type FaqRow } from "@/lib/faqs.functions";
import { excerptFrom, renderArticle } from "@/lib/blogContent";
import { SITE_URL } from "@/lib/seo";
import { diagnoseBackendError } from "@/lib/backendErrors";
import { SupabaseConfigNotice } from "@/components/SupabaseConfigNotice";
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";

/**
 * RATGEBER-VERWALTUNG
 * --------------------
 * Vollständige Eingabemaske für Blog-/Ratgeber-Beiträge: Inhalt in
 * Markdown, Bild-Upload in den Storage-Bucket "blog-images", dazu ein
 * eigener SEO- und Anzeigen-Abschnitt (Meta-Tags, Open-Graph-Bild,
 * Fokus-Keywords) und die Mehrfachauswahl passender FAQs.
 */

export const Route = createFileRoute("/_authenticated/_admin/admin/blog")({
  head: () => ({
    meta: [
      { title: "Ratgeber-Verwaltung – White Gloss Detailing" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BlogAdminRoute,
  errorComponent: ({ error }) => <SupabaseConfigNotice info={diagnoseBackendError(error)} />,
});

function BlogAdminRoute() {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return <SupabaseConfigNotice missing={config.missing} />;
  return <BlogAdminPage />;
}

const MAX_BYTES = 8 * 1024 * 1024;

const EMPTY_POST: BlogPostInput = {
  slug: "",
  title: "",
  content: "",
  excerpt: "",
  featuredImageUrl: null,
  author: "White Gloss Detailing",
  publishedAt: null,
  metaTitle: "",
  metaDescription: "",
  ogImageUrl: null,
  focusKeywords: [],
  faqIds: [],
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // "data:image/jpeg;base64,AAAA..." -> nur den Teil nach dem Komma senden
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

/** Erzeugt aus dem Titel eine URL-taugliche Kurzform (wie im Frontend). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** ISO-Zeitstempel -> Wert für <input type="datetime-local"> (lokale Zeit). */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function BlogAdminPage() {
  const [posts, setPosts] = useState<BlogPostSummary[] | null>(null);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; values: BlogPostInput } | null>(null);

  const fetchPosts = useServerFn(listAllBlogPosts);
  const fetchFaqs = useServerFn(listAllFaqs);
  const fetchPost = useServerFn(getBlogPostForEdit);

  const reload = useCallback(() => {
    setLoadError(null);
    void Promise.all([fetchPosts({}), fetchFaqs({}).catch(() => [])])
      .then(([nextPosts, nextFaqs]) => {
        setPosts(nextPosts);
        setFaqs(nextFaqs);
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Beiträge konnten nicht geladen werden.",
        );
      });
  }, [fetchPosts, fetchFaqs]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchPosts({}), fetchFaqs({}).catch(() => [])])
      .then(([nextPosts, nextFaqs]) => {
        if (!active) return;
        setPosts(nextPosts);
        setFaqs(nextFaqs);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Beiträge konnten nicht geladen werden.",
        );
      });
    return () => {
      active = false;
    };
  }, [fetchPosts, fetchFaqs]);

  /** Beitrag zum Bearbeiten laden — inkl. Volltext und FAQ-Zuordnung. */
  async function openForEdit(id: string) {
    try {
      const post = await fetchPost({ data: { id } });
      if (!post) {
        toast.error("Der Beitrag wurde nicht gefunden.");
        reload();
        return;
      }
      setEditing({
        id: post.id,
        values: {
          slug: post.slug,
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
          featuredImageUrl: post.featured_image_url,
          author: post.author,
          publishedAt: post.published_at,
          metaTitle: post.meta_title,
          metaDescription: post.meta_description,
          ogImageUrl: post.og_image_url,
          focusKeywords: post.focus_keywords,
          faqIds: post.faqIds,
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Beitrag konnte nicht geladen werden.");
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
            <FileText className="size-4 text-primary" />
            <h1 className="display-card text-sm uppercase">Ratgeber-Verwaltung</h1>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {editing ? (
          <BlogForm
            key={editing.id ?? "new"}
            id={editing.id}
            initial={editing.values}
            faqs={faqs}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        ) : (
          <>
            <div className="glass mb-6 rounded-2xl p-5 text-sm leading-6 text-muted-foreground">
              <p>
                Beiträge erscheinen unter{" "}
                <a href="/ratgeber" className="text-primary underline underline-offset-2">
                  /ratgeber
                </a>
                . Ohne Veröffentlichungsdatum bleibt ein Beitrag ein Entwurf und ist für Besucher
                und Google unsichtbar. Ein Datum in der Zukunft plant die Veröffentlichung vor.
              </p>
            </div>

            <Button
              className="gap-1.5"
              onClick={() => setEditing({ id: null, values: EMPTY_POST })}
            >
              <Plus className="size-4" />
              Neuen Beitrag schreiben
            </Button>

            {loadError ? (
              <div className="glass mt-6 rounded-2xl border border-destructive/30 p-5 text-sm">
                <p className="text-destructive">{loadError}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
                  Erneut laden
                </Button>
              </div>
            ) : posts === null ? (
              <p className="mt-6 text-sm text-muted-foreground">Wird geladen …</p>
            ) : posts.length === 0 ? (
              <p className="glass mt-6 rounded-2xl p-8 text-center text-sm text-muted-foreground">
                Noch keine Beiträge angelegt.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {posts.map((post) => (
                  <li key={post.id}>
                    <BlogCard
                      post={post}
                      onEdit={() => void openForEdit(post.id)}
                      onChanged={reload}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function BlogCard({
  post,
  onEdit,
  onChanged,
}: {
  post: BlogPostSummary;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const remove = useServerFn(deleteBlogPost);

  const publishedAt = post.published_at ? new Date(post.published_at) : null;
  const isScheduled = publishedAt !== null && publishedAt.getTime() > Date.now();

  async function handleDelete() {
    if (!window.confirm(`„${post.title}" wirklich endgültig löschen?`)) return;
    setBusy(true);
    try {
      const result = await remove({ data: { id: post.id } });
      if (result.storageWarning) {
        toast.warning("Beitrag gelöscht, das Bild konnte aber nicht entfernt werden.");
      } else {
        toast.success("Beitrag gelöscht.");
      }
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {!publishedAt && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">
              Entwurf
            </span>
          )}
          {isScheduled && (
            <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-300">
              Geplant für {publishedAt.toLocaleDateString("de-DE")}
            </span>
          )}
          {publishedAt && !isScheduled && (
            <span className="text-xs text-muted-foreground">
              Veröffentlicht am {publishedAt.toLocaleDateString("de-DE")}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-sm font-medium text-foreground">{post.title}</h2>
        <p className="mt-1 truncate text-xs text-muted-foreground">/ratgeber/{post.slug}</p>
        {post.excerpt && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {post.excerpt}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-1">
        <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}>
          Bearbeiten
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          loading={busy}
          aria-label={`„${post.title}" löschen`}
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function BlogForm({
  id,
  initial,
  faqs,
  onCancel,
  onSaved,
}: {
  id: string | null;
  initial: BlogPostInput;
  faqs: FaqRow[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BlogPostInput>(initial);
  const [keywordText, setKeywordText] = useState(initial.focusKeywords.join(", "));
  const [saving, setSaving] = useState(false);
  // Nur bei einem neuen Beitrag den Slug automatisch mitführen — bei einem
  // veröffentlichten Beitrag würde eine Slug-Änderung die URL brechen.
  const [slugLocked, setSlugLocked] = useState(id !== null);

  const create = useServerFn(createBlogPost);
  const update = useServerFn(updateBlogPost);

  function set<K extends keyof BlogPostInput>(key: K, value: BlogPostInput[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleTitleChange(value: string) {
    setForm((previous) => ({
      ...previous,
      title: value,
      slug: slugLocked ? previous.slug : slugify(value),
    }));
  }

  // Vorschau der Gliederung: zeigt dem Redakteur, welche Anker-Links Google
  // als Sitelinks anbieten kann.
  const outline = useMemo(() => renderArticle(form.content).headings, [form.content]);

  const effectiveMetaTitle = form.metaTitle || `${form.title} | White Gloss Detailing`;
  const effectiveMetaDescription =
    form.metaDescription || form.excerpt || excerptFrom(renderArticle(form.content).plainText, 160);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: BlogPostInput = {
        ...form,
        focusKeywords: keywordText
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean),
      };
      if (id) {
        await update({ data: { id, ...payload } });
        toast.success("Beitrag gespeichert.");
      } else {
        await create({ data: payload });
        toast.success("Beitrag angelegt.");
      }
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ---------- Inhalt ---------- */}
      <section className="glass space-y-4 rounded-2xl p-5">
        <h2 className="display-card text-sm uppercase">
          {id ? "Beitrag bearbeiten" : "Neuer Beitrag"}
        </h2>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Titel</span>
          <Input
            value={form.title}
            onChange={(event) => handleTitleChange(event.target.value)}
            placeholder="z. B. Keramikversiegelung: Was sie kostet und wie lange sie hält"
            maxLength={160}
            required
            className="mt-1.5 bg-secondary/40"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            URL-Kurzform
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">/ratgeber/</span>
            <Input
              value={form.slug}
              onChange={(event) => {
                setSlugLocked(true);
                set("slug", slugify(event.target.value));
              }}
              placeholder="keramikversiegelung-kosten"
              maxLength={80}
              required
              className="bg-secondary/40"
            />
          </div>
          {id && (
            <span className="mt-1 block text-xs text-amber-300/90">
              Achtung: Eine Änderung ändert die URL. Bereits geteilte Links und Google-Treffer
              laufen dann ins Leere.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Inhalt (Markdown)
          </span>
          <Textarea
            value={form.content}
            onChange={(event) => set("content", event.target.value)}
            rows={18}
            placeholder={
              "## Was ist eine Keramikversiegelung?\n\nFließtext …\n\n- Aufzählungspunkt\n- Weiterer Punkt\n\n### Kosten\n\nMehr Text mit **Hervorhebung** und [Link](/preise)."
            }
            className="mt-1.5 bg-secondary/40 font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            `##` erzeugt eine Hauptüberschrift, `###` eine Unterüberschrift. Aus beiden entsteht
            automatisch das Inhaltsverzeichnis. HTML wird aus Sicherheitsgründen als Text angezeigt.
          </span>
        </label>

        {outline.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Automatisches Inhaltsverzeichnis
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {outline.map((heading) => (
                <li key={heading.id} className={heading.level === 3 ? "pl-4" : ""}>
                  {heading.text}
                  <span className="ml-2 text-xs text-muted-foreground/60">#{heading.id}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Kurzfassung (optional)
          </span>
          <Textarea
            value={form.excerpt}
            onChange={(event) => set("excerpt", event.target.value)}
            rows={2}
            maxLength={320}
            placeholder="Ein bis zwei Sätze für die Übersichtsseite und die Link-Vorschau."
            className="mt-1.5 bg-secondary/40"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Autor</span>
            <Input
              value={form.author}
              onChange={(event) => set("author", event.target.value)}
              maxLength={120}
              className="mt-1.5 bg-secondary/40"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Veröffentlichung
            </span>
            <Input
              type="datetime-local"
              value={toLocalInputValue(form.publishedAt)}
              onChange={(event) =>
                set(
                  "publishedAt",
                  event.target.value ? new Date(event.target.value).toISOString() : null,
                )
              }
              className="mt-1.5 bg-secondary/40"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Leer lassen = Entwurf. Datum in der Zukunft = geplante Veröffentlichung.
            </span>
          </label>
        </div>

        {!form.publishedAt && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set("publishedAt", new Date().toISOString())}
          >
            Jetzt veröffentlichen
          </Button>
        )}
      </section>

      {/* ---------- Bilder ---------- */}
      <section className="glass space-y-4 rounded-2xl p-5">
        <h2 className="display-card text-sm uppercase">Beitragsbild</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Empfohlen: 1600 × 900 Pixel (16:9). Die Bildmaße werden beim Hochladen automatisch
          ermittelt und im Artikel als width/height gesetzt — dadurch springt das Layout beim Laden
          nicht (guter CLS-Wert).
        </p>
        <ImageField
          label="Beitragsbild"
          value={form.featuredImageUrl}
          onChange={(url) => set("featuredImageUrl", url)}
        />
      </section>

      {/* ---------- SEO & Anzeigen ---------- */}
      <section className="glass space-y-4 rounded-2xl p-5">
        <h2 className="display-card text-sm uppercase">SEO &amp; Anzeigen</h2>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Meta-Titel
          </span>
          <Input
            value={form.metaTitle}
            onChange={(event) => set("metaTitle", event.target.value)}
            placeholder={`${form.title || "Titel"} | White Gloss Detailing`}
            maxLength={70}
            className="mt-1.5 bg-secondary/40"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {form.metaTitle.length}/70 Zeichen — darüber kürzt Google sichtbar ab. Leer lassen
            übernimmt den Titel.
          </span>
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Meta-Beschreibung
          </span>
          <Textarea
            value={form.metaDescription}
            onChange={(event) => set("metaDescription", event.target.value)}
            rows={3}
            maxLength={180}
            placeholder="Was erfährt der Leser? Ein bis zwei Sätze mit dem wichtigsten Suchbegriff."
            className="mt-1.5 bg-secondary/40"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {form.metaDescription.length}/180 Zeichen. Leer lassen übernimmt die Kurzfassung.
          </span>
        </label>

        {/* Vorschau, wie der Treffer in der Google-Suche aussieht. */}
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Vorschau Google-Treffer
          </p>
          <p className="mt-2 truncate text-xs text-emerald-400/80">
            {SITE_URL}/ratgeber/{form.slug || "…"}
          </p>
          <p className="truncate text-base text-sky-300">{effectiveMetaTitle}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {effectiveMetaDescription || "…"}
          </p>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Fokus-Keywords
          </span>
          <Input
            value={keywordText}
            onChange={(event) => setKeywordText(event.target.value)}
            placeholder="keramikversiegelung kosten, lackversiegelung horb"
            className="mt-1.5 bg-secondary/40"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Mit Komma trennen, höchstens zehn. Dienen der internen Redaktionsplanung und werden als
            Artikel-Schlagwörter ausgezeichnet.
          </span>
        </label>

        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Eigenes Vorschaubild für Facebook &amp; Instagram (optional)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ohne eigenes Bild wird das Beitragsbild verwendet. Empfohlen: 1200 × 630 Pixel.
          </p>
          <div className="mt-2">
            <ImageField
              label="Open-Graph-Bild"
              value={form.ogImageUrl}
              onChange={(url) => set("ogImageUrl", url)}
            />
          </div>
        </div>
      </section>

      {/* ---------- FAQ-Zuordnung ---------- */}
      <section className="glass space-y-4 rounded-2xl p-5">
        <h2 className="display-card text-sm uppercase">Passende FAQs zuordnen</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Ausgewählte Fragen erscheinen unter dem Artikel und werden zusätzlich als FAQ-Rich-Result
          ausgezeichnet. Die Reihenfolge entspricht der Reihenfolge des Anklickens.
        </p>
        <FaqMultiSelect
          faqs={faqs}
          selectedIds={form.faqIds}
          onChange={(faqIds) => set("faqIds", faqIds)}
        />
      </section>

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

/**
 * Bildfeld: entweder hochladen (landet im Bucket "blog-images") oder eine
 * vorhandene https-Adresse eintragen.
 */
function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadBlogImage);
  const inputId = `blog-image-${label.replace(/\s+/g, "-").toLowerCase()}`;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Nur JPEG, PNG oder WebP werden unterstützt.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Datei ist größer als 8 MB.");
      event.currentTarget.value = "";
      return;
    }

    setUploading(true);
    try {
      const base64Data = await fileToBase64(file);
      const result = await upload({
        data: { fileName: file.name, contentType: file.type, base64Data },
      });
      onChange(result.publicUrl);
      toast.success(
        result.width && result.height
          ? `Bild hochgeladen (${result.width} × ${result.height} Pixel).`
          : "Bild hochgeladen.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hochladen fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {value && (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <img
            src={value}
            alt={`Vorschau: ${label}`}
            loading="lazy"
            decoding="async"
            className="max-h-56 w-full object-cover"
          />
        </div>
      )}

      <Input
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value.trim() || null)}
        placeholder="https://… (oder unten hochladen)"
        className="bg-secondary/40"
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={uploading}
        aria-label={`${label} auswählen`}
        className="hidden"
        id={inputId}
      />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" loading={uploading} className="gap-1.5">
          <label htmlFor={inputId} className="cursor-pointer">
            <Upload className="size-3.5" />
            {uploading ? "Wird hochgeladen …" : "Bild hochladen"}
          </label>
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(null)}
            className="gap-1.5 text-destructive hover:bg-destructive/10"
          >
            <ImageIcon className="size-3.5" />
            Entfernen
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Mehrfachauswahl der FAQs mit Suchfeld und Gruppierung nach Kategorie.
 * Bewusst als Checkbox-Liste statt als <select multiple>: auf Mobilgeräten
 * ist ein natives Mehrfach-Select kaum bedienbar.
 */
function FaqMultiSelect({
  faqs,
  selectedIds,
  onChange,
}: {
  faqs: FaqRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return faqs;
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(needle) || faq.category.toLowerCase().includes(needle),
    );
  }, [faqs, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, FaqRow[]>();
    for (const faq of filtered) {
      const key = faq.category || "Ohne Kategorie";
      const bucket = groups.get(key);
      if (bucket) bucket.push(faq);
      else groups.set(key, [faq]);
    }
    return [...groups.entries()];
  }, [filtered]);

  function toggle(faqId: string) {
    // Auswahlreihenfolge beibehalten: sie bestimmt die Anzeigereihenfolge
    // unter dem Artikel.
    onChange(
      selectedIds.includes(faqId)
        ? selectedIds.filter((id) => id !== faqId)
        : [...selectedIds, faqId],
    );
  }

  if (faqs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine FAQs vorhanden —{" "}
        <Link to="/admin/faqs" className="text-primary underline underline-offset-2">
          zuerst FAQs anlegen
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="FAQs durchsuchen …"
        className="bg-secondary/40"
      />

      <p className="text-xs text-muted-foreground">{selectedIds.length} FAQ(s) ausgewählt</p>

      <div className="max-h-80 space-y-4 overflow-y-auto rounded-xl border border-border/60 p-4">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Treffer.</p>
        ) : (
          grouped.map(([category, items]) => (
            <div key={category}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{category}</p>
              <ul className="mt-2 space-y-2">
                {items.map((faq) => {
                  const position = selectedIds.indexOf(faq.id);
                  return (
                    <li key={faq.id}>
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={position !== -1}
                          onChange={() => toggle(faq.id)}
                          className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                        />
                        <span className="text-sm text-foreground/85">
                          {position !== -1 && (
                            <span className="mr-1.5 text-xs text-primary">{position + 1}.</span>
                          )}
                          {faq.question}
                          {!faq.is_published && (
                            <span className="ml-2 text-xs text-amber-300/90">(Entwurf)</span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
