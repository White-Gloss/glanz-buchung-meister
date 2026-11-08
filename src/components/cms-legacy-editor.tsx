import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useBlocker } from "@tanstack/react-router";
import { listLegacyCms, saveLegacyCms, deleteLegacyCms } from "@/lib/cms.functions";
import type { LegacyCmsKind, LegacyCmsRow } from "@/lib/cms-legacy.store";
import { Button, inputClass } from "./ui";

export type CmsEditorProps = {
  kind: LegacyCmsKind; heading: string; kicker: string; hint: string;
  slugField?: boolean; extraLabel?: string;
};
const message = (error: unknown) => error instanceof Error ? error.message : "Der Vorgang ist fehlgeschlagen. Ihre Eingaben bleiben erhalten.";

export function LegacyCmsEditor({ kind, heading, kicker, hint, slugField, extraLabel }: CmsEditorProps) {
  const [rows, setRows] = useState<LegacyCmsRow[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [slug, setSlug] = useState("");
  const [extra, setExtra] = useState("");
  const [editing, setEditing] = useState<LegacyCmsRow | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LegacyCmsRow | null>(null);
  const lock = useRef(false);
  const navigation = useBlocker({ shouldBlockFn: () => dirty || busy, enableBeforeUnload: dirty || busy, withResolver: true });
  const reload = useCallback(async () => {
    try { setRows(await listLegacyCms({ data: { kind } })); setLoadError(""); }
    catch (failure) { setLoadError(message(failure)); }
  }, [kind]);
  useEffect(() => { void reload(); }, [reload]);
  function reset() {
    setTitle(""); setBody(""); setSlug(""); setExtra(""); setEditing(null); setDirty(false);
  }
  function edit(row: LegacyCmsRow) {
    if (lock.current || dirty || row.studioManaged) return;
    setEditing(row); setTitle(row.title); setBody(row.body); setSlug(row.slug ?? "");
    try { setExtra((JSON.parse(row.extra) as { note?: string }).note ?? ""); } catch { setExtra(""); }
    setError(""); setStatus("");
  }
  function changed(change: () => void) { if (!lock.current) { change(); setDirty(true); setStatus(""); } }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current || rows === null || loadError) return;
    lock.current = true; setBusy(true); setError(""); setStatus("");
    try {
      let metadata: Record<string, unknown> = {};
      try {
        const existing: unknown = JSON.parse(editing?.extra ?? "{}");
        if (existing && typeof existing === "object" && !Array.isArray(existing)) metadata = existing as Record<string, unknown>;
      } catch { /* Existing free-form metadata has no named fields to merge. */ }
      await saveLegacyCms({ data: { id: editing?.id, kind, expectedVersion: editing?.version, title, body, slug: slug || undefined, extra: JSON.stringify({ ...metadata, ...(extraLabel ? { note: extra } : {}) }) } });
      reset(); setStatus("Änderung veröffentlicht."); await reload();
    } catch (failure) { setError(message(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function remove() {
    if (lock.current || !pendingDelete) return;
    lock.current = true; setBusy(true); setError(""); setStatus("");
    try {
      await deleteLegacyCms({ data: { id: pendingDelete.id, kind, expectedVersion: pendingDelete.version } });
      if (editing?.id === pendingDelete.id) reset();
      setPendingDelete(null); setStatus("Eintrag gelöscht."); await reload();
    } catch (failure) { setError(message(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <p className="text-xs uppercase tracking-[0.16em] text-subtle">{kicker}</p>
    <h1 className="mt-2 font-display text-4xl">{heading}</h1>
    <p className="mt-3 text-sm leading-relaxed text-muted">{hint}</p>
    <p className="mt-3 text-sm text-muted">Bisherige Inhaltsverwaltung: Änderungen werden beim Speichern direkt veröffentlicht. Entwürfe und Bild-Uploads stehen nach der Aktivierung von Website Studio bereit.</p>
    {loadError ? <div className="mt-4"><p role="alert" className="text-danger">{loadError}</p><Button type="button" onClick={() => void reload()} disabled={busy}>Einträge erneut laden</Button></div> : null}
    {error ? <p role="alert" className="mt-4 text-danger">{error}</p> : null}
    {status ? <p role="status" className="mt-4">{status}</p> : null}
    <form onSubmit={save} className="mt-8 space-y-3 rounded-md border border-line bg-surface p-5">
      <fieldset disabled={busy || rows === null || Boolean(loadError)} className="space-y-3">
        {slugField ? <label className="flex flex-col gap-1 text-sm">Slug<input className={inputClass} value={slug} onChange={(e) => changed(() => setSlug(e.target.value))} /></label> : null}
        <label className="flex flex-col gap-1 text-sm">Titel<input className={inputClass} value={title} onChange={(e) => changed(() => setTitle(e.target.value))} required minLength={2} maxLength={200} /></label>
        <label className="flex flex-col gap-1 text-sm">Text<textarea className={`${inputClass} min-h-28 py-2`} value={body} onChange={(e) => changed(() => setBody(e.target.value))} required /></label>
        {extraLabel ? <label className="flex flex-col gap-1 text-sm">{extraLabel}<input className={inputClass} value={extra} onChange={(e) => changed(() => setExtra(e.target.value))} /></label> : null}
        <div className="flex flex-wrap gap-2"><Button type="submit">{busy ? "Wird gespeichert …" : "Speichern und veröffentlichen"}</Button>{editing || dirty ? <Button type="button" variant="ghost" onClick={reset}>Bearbeitung verwerfen</Button> : null}</div>
      </fieldset>
    </form>
    {rows === null && !loadError ? <p role="status" className="mt-8 text-sm text-muted">Einträge werden geladen …</p> : rows?.length === 0 ? <p className="mt-8 text-sm text-muted">Noch keine Einträge. Die Website nutzt die festen Inhalte.</p> : <ul className="mt-8 space-y-3">{rows?.map((row) => <li key={row.id} className="rounded-md border border-line bg-surface p-5">
      <h2 className="font-display text-2xl">{row.title}</h2>{row.slug ? <p className="text-xs text-subtle">{row.slug}</p> : null}<p className="mt-2 whitespace-pre-wrap text-sm text-muted">{row.body}</p>
      {row.studioManaged ? <p className="mt-3 text-sm text-muted">Dieser Eintrag besitzt geschützte Website-Studio-Fassungen. Zur Bearbeitung muss Website Studio wieder aktiviert werden.</p> : <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="ghost" disabled={busy || dirty || Boolean(loadError)} onClick={() => edit(row)}>Bearbeiten</Button><Button type="button" variant="ghost" disabled={busy || dirty || Boolean(loadError)} onClick={() => setPendingDelete(row)}>Löschen</Button></div>}
    </li>)}</ul>}
    {pendingDelete ? <section aria-label="Löschen bestätigen" className="mt-6 rounded-md border border-line bg-surface p-5"><p>„{pendingDelete.title}“ endgültig löschen?</p><div className="mt-4 flex gap-2"><Button type="button" disabled={busy} onClick={() => void remove()}>Jetzt löschen</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setPendingDelete(null)}>Abbrechen</Button></div></section> : null}
    {navigation.status === "blocked" ? <section aria-label="Ungespeicherte Änderungen" className="mt-6 rounded-md border border-line bg-surface p-5"><p>Ihre Änderungen sind noch nicht gespeichert.</p><div className="mt-4 flex gap-2"><Button type="button" disabled={busy} onClick={() => navigation.proceed()}>Änderungen verwerfen und verlassen</Button><Button type="button" variant="ghost" onClick={() => navigation.reset()}>Weiter bearbeiten</Button></div></section> : null}
  </main>;
}
