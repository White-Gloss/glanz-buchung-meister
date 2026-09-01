import { useEffect, useState, type FormEvent } from "react";
import {
  deleteCms,
  listCms,
  upsertCms,
  type CmsKind,
  type CmsRow,
} from "@/lib/cms.functions";
import { Button, inputClass } from "./ui";

export function CmsEditor({
  kind,
  heading,
  kicker,
  hint,
  slugField,
  extraLabel,
}: {
  kind: CmsKind;
  heading: string;
  kicker: string;
  hint: string;
  slugField?: boolean;
  extraLabel?: string;
}) {
  const [rows, setRows] = useState<CmsRow[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [slug, setSlug] = useState("");
  const [extra, setExtra] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function reload() {
    setRows(await listCms({ data: { kind } }));
  }

  useEffect(() => {
    void reload().catch(() => setRows([]));
  }, [kind]);

  function reset() {
    setTitle("");
    setBody("");
    setSlug("");
    setExtra("");
    setEditing(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await upsertCms({
        data: {
          id: editing ?? undefined,
          kind,
          title,
          body,
          slug: slug || undefined,
          extra: extra ? JSON.stringify({ note: extra }) : "{}",
          published: true,
        },
      });
      reset();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">{kicker}</p>
      <h1 className="mt-2 font-display text-4xl">{heading}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{hint}</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-3 rounded-md border border-line bg-surface p-5">
        {slugField ? (
          <label className="flex flex-col gap-1 text-sm">
            Slug
            <input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          Titel
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Text
          <textarea
            className={`${inputClass} min-h-28 py-2`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </label>
        {extraLabel ? (
          <label className="flex flex-col gap-1 text-sm">
            {extraLabel}
            <input className={inputClass} value={extra} onChange={(e) => setExtra(e.target.value)} />
          </label>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{editing ? "Aktualisieren" : "Anlegen"}</Button>
          {editing ? (
            <Button type="button" variant="ghost" onClick={reset}>
              Abbrechen
            </Button>
          ) : null}
        </div>
      </form>
      {rows === null ? (
        <p className="mt-8 text-sm text-muted">Laden …</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Noch keine Einträge. Die Website nutzt dann die festen Inhalte.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-md border border-line bg-surface p-5">
              <h2 className="font-display text-2xl">{row.title}</h2>
              {row.slug ? <p className="text-xs text-subtle">{row.slug}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{row.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(row.id);
                    setTitle(row.title);
                    setBody(row.body);
                    setSlug(row.slug ?? "");
                    try {
                      const parsed = JSON.parse(row.extra) as { note?: string };
                      setExtra(parsed.note ?? "");
                    } catch {
                      setExtra("");
                    }
                  }}
                >
                  Bearbeiten
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    await deleteCms({ data: { id: row.id } });
                    await reload();
                  }}
                >
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
