import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { cities, services, site } from "@/data/site";
import { customerPhotos, featuredPhotoIds } from "@/data/customer-photos";
import { citySeoCopy } from "@/lib/city-copy";
import {
  getCmsStudioDocument,
  listCmsStudioDocuments,
  saveCmsDraft,
  publishCmsRevision,
  restoreCmsRevisionAsDraft,
  archiveCmsDocument,
  upsertCms,
  type CmsKind,
  type CmsStudioDocument,
  type CmsStudioSummary,
} from "@/lib/cms.functions";
import { emptyCmsContent, type CmsDocumentContent, type CmsDocumentKey } from "@/lib/cms.model";
import type { StudioAsset } from "@/lib/studio-media.model";
import { Button, inputClass } from "./ui";
import { WebsiteStudioContent } from "./website-studio-content";
import { WebsiteStudioMedia } from "./website-studio-media";
import { WebsiteStudioFields } from "./website-studio-fields";
import { createStudioRequestGate, studioCanPublish } from "./website-studio-state";
import type { StudioActivity } from "./website-studio-activity";

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Der Vorgang ist fehlgeschlagen. Ihr ungespeicherter Text bleibt erhalten.";
const pageTargets: { key: CmsDocumentKey; label: string; group: string }[] = [
  { key: "home", label: "Startseite", group: "Seiten" },
  { key: "about", label: "Über uns", group: "Seiten" },
  { key: "gallery", label: "Galerie", group: "Seiten" },
  ...services.map((service) => ({
    key: `service:${service.slug}` as CmsDocumentKey,
    label: service.nav,
    group: "Leistungen",
  })),
  ...cities.map((city) => ({
    key: `city:${city.slug}` as CmsDocumentKey,
    label: city.name,
    group: "Abholorte",
  })),
];
function seed(key: CmsDocumentKey): CmsDocumentContent {
  const content = emptyCmsContent();
  const service = services.find((item) => key === `service:${item.slug}`);
  const city = cities.find((item) => key === `city:${item.slug}`);
  if (service)
    return {
      ...content,
      title: service.title,
      lead: service.teaser,
      body: service.body.join("\n\n"),
      metaTitle: service.metaTitle,
      metaDescription: service.description,
    };
  if (city) {
    const copy = citySeoCopy(city);
    return {
      ...content,
      title: copy.heading,
      lead: city.blurb,
      body: city.pickupNote ?? "",
      metaTitle: copy.title,
      metaDescription: copy.description,
    };
  }
  if (key === "about")
    return {
      ...content,
      title: `Über ${site.legalName}`,
      lead: `${site.owner} · Fahrzeugaufbereitung in ${site.city}`,
    };
  if (key === "home")
    return {
      ...content,
      title: "Ihr Auto.\nNicht nur sauber.\nWieder besonders.",
      lead: "Fahrzeugaufbereitung, Lackkorrektur und Keramikschutz in Horb – persönlich geprüft, stressfrei abgeholt und digital übergeben.",
      body: "Für den täglichen Weg zur Arbeit, Ihren Liebhaberwagen oder die Leasingrückgabe: Wir prüfen Ihr Fahrzeug persönlich und stimmen Pflege, Preis und Termin mit Ihnen ab.",
    };
  if (key === "gallery") {
    const ordered = [
      ...featuredPhotoIds.map((id) => customerPhotos.find((photo) => photo.id === id)!),
      ...customerPhotos.filter((photo) => !featuredPhotoIds.includes(photo.id)),
    ];
    return {
      ...content,
      title: "Echte Ergebnisse aus unserer Werkstatt.",
      lead: "Lack, Leder, Felgen. Entdecken Sie unsere Arbeit an einem echten Kundenfahrzeug - in Bildern und kurzen Filmen.",
      images: ordered.map((photo) => ({
        assetId: `static:${photo.id}`,
        alt: photo.alt,
        caption: photo.title,
      })),
    };
  }
  return content;
}

export function WebsiteStudio({ initialKind }: { initialKind?: CmsKind }) {
  const [key, setKey] = useState<CmsDocumentKey>(
    initialKind === "gallery"
      ? "gallery"
      : initialKind === "service"
        ? `service:${services[0].slug}`
        : "home",
  );
  const [document, setDocument] = useState<CmsStudioDocument | null>(null);
  const [content, setContent] = useState<CmsDocumentContent>(() => seed(key));
  const [summaries, setSummaries] = useState<CmsStudioSummary[]>([]);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mediaActivity, setMediaActivity] = useState<StudioActivity>({ dirty: false, busy: false });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"edit" | "preview" | "media" | "history">("edit");
  const [pendingKey, setPendingKey] = useState<CmsDocumentKey | null>(null);
  const [confirm, setConfirm] = useState<"publish" | "archive" | null>(null);
  const [newKind, setNewKind] = useState<"faq" | "blog" | "service">(
    initialKind === "service" ? "service" : initialKind === "blog" ? "blog" : "faq",
  );
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [requests] = useState(createStudioRequestGate);
  const actionLock = useRef(false);
  const hasUnsavedChanges = dirty || mediaActivity.dirty;
  const hasPendingOperation = busy || mediaActivity.busy;
  const reportMediaActivity = useCallback((next: StudioActivity) => {
    setMediaActivity((current) =>
      current.dirty === next.dirty && current.busy === next.busy ? current : next,
    );
  }, []);
  const navigation = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges || hasPendingOperation,
    enableBeforeUnload: hasUnsavedChanges || hasPendingOperation,
    withResolver: true,
  });
  const activeKey = useRef(key);
  activeKey.current = key;
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const refreshSummaries = useCallback(async () => {
    setSummaries(await listCmsStudioDocuments());
  }, []);
  const apply = useCallback((result: CmsStudioDocument & { assets?: StudioAsset[] }) => {
    if (result.key !== activeKey.current) return;
    setDocument(result);
    if (result.assets)
      setAssets((current) => [
        ...current.filter((asset) => !result.assets!.some((next) => next.id === asset.id)),
        ...result.assets!,
      ]);
    setContent(
      result.draft ?? result.published ?? (result.archived ? emptyCmsContent() : seed(result.key)),
    );
    setDirty(false);
  }, []);
  useEffect(() => {
    const request = requests.begin();
    setLoading(true);
    setError("");
    setStatus("");
    setDocument(null);
    setConfirm(null);
    setLoadFailed(false);
    void getCmsStudioDocument({ data: { key } })
      .then((result) => {
        if (request.isCurrent()) apply(result);
      })
      .catch((error) => {
        if (request.isCurrent()) {
          setLoadFailed(true);
          setError(errorMessage(error));
        }
      })
      .finally(() => {
        if (request.isCurrent()) setLoading(false);
      });
    return request.cancel;
  }, [key, retry, apply, requests]);
  useEffect(() => {
    void refreshSummaries().catch((error) => setError(errorMessage(error)));
  }, [refreshSummaries]);
  function edit(patch: Partial<CmsDocumentContent>) {
    if (actionLock.current || busy || document?.archived) return;
    setContent((current) => ({ ...current, ...patch }));
    setDirty(true);
    setStatus("");
    setConfirm(null);
  }
  function choose(next: CmsDocumentKey) {
    if (next === key || actionLock.current || hasPendingOperation) return;
    if (dirty) setPendingKey(next);
    else {
      setKey(next);
      setView("edit");
    }
  }
  async function action(operation: "save" | "publish" | "archive" | number) {
    if (!document || actionLock.current) return;
    if (document.archived && typeof operation !== "number") {
      setError(
        "Dieser Inhalt ist zurückgezogen. Stellen Sie zuerst unter Fassungen einen Entwurf wieder her.",
      );
      return;
    }
    actionLock.current = true;
    setBusy(true);
    setError("");
    setConfirm(null);
    try {
      const references = {
        key,
        expectedDraftRevisionId: document.draftRevisionId,
        expectedPublishedRevisionId: document.publishedRevisionId,
      };
      if (operation === "save")
        apply(
          await saveCmsDraft({
            data: { key, expectedDraftRevisionId: document.draftRevisionId, content },
          }),
        );
      else if (operation === "publish") {
        if (document.draftRevisionId === null || dirty)
          throw new Error("Bitte zuerst den aktuellen Entwurf speichern und prüfen.");
        apply(
          await publishCmsRevision({
            data: { ...references, revisionId: document.draftRevisionId },
          }),
        );
      } else if (operation === "archive") apply(await archiveCmsDocument({ data: references }));
      else
        apply(
          await restoreCmsRevisionAsDraft({
            data: { key, revisionId: operation, expectedDraftRevisionId: document.draftRevisionId },
          }),
        );
      setStatus(
        operation === "save"
          ? "Entwurf gespeichert. Die öffentliche Website bleibt unverändert."
          : operation === "publish"
            ? "Die geprüfte Fassung ist veröffentlicht."
            : operation === "archive"
              ? "Der redaktionelle Inhalt wurde zurückgezogen. Vorhandene Standardinhalte bleiben erhalten."
              : "Fassung als neuer Entwurf wiederhergestellt. Die Live-Fassung bleibt unverändert.",
      );
      try {
        await refreshSummaries();
      } catch {
        setError(
          "Der Vorgang wurde gespeichert. Die Seitenliste konnte nicht aktualisiert werden; bitte erneut laden.",
        );
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  function selectImage(asset: StudioAsset) {
    if (actionLock.current || busy || document?.archived) return;
    if (content.images.some((image) => image.assetId === asset.id)) {
      setStatus("Dieses Bild ist bereits auf der Seite ausgewählt.");
      return;
    }
    edit({
      images: [...content.images, { assetId: asset.id, alt: asset.alt, caption: asset.caption }],
    });
    setView("edit");
  }
  async function createEntry() {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug) || actionLock.current) return;
    if (newKind !== "service") {
      choose(`${newKind}:${newSlug}`);
      return;
    }
    if (dirty) {
      setError("Bitte den aktuellen Entwurf speichern, bevor Sie eine Zusatzleistung anlegen.");
      return;
    }
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      const created = await upsertCms({
        data: { kind: "service", slug: newSlug, title: newTitle, body: "", published: false },
      });
      if (!created.id) throw new Error("Die Zusatzleistung konnte nicht angelegt werden.");
      setKey(`legacy:${created.id}`);
      setView("edit");
      setNewTitle("");
      setNewSlug("");
      try {
        await refreshSummaries();
      } catch {
        setError("Der Entwurf wurde angelegt. Die Seitenliste konnte nicht aktualisiert werden.");
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  const targets = [
    ...pageTargets,
    ...summaries
      .filter((item) => !pageTargets.some((target) => target.key === item.key))
      .map((item) => ({
        key: item.key,
        label: item.title || item.key,
        group:
          item.kind === "faq" ? "Fragen" : item.kind === "blog" ? "Ratgeber" : "Bisherige Inhalte",
      })),
  ];
  const canPublish =
    document &&
    studioCanPublish({
      dirty: hasUnsavedChanges,
      busy: hasPendingOperation,
      draftRevisionId: document.draftRevisionId,
      publishedRevisionId: document.publishedRevisionId,
      archived: document.archived,
    });
  const unavailable = loading || hasPendingOperation || !document || document.archived;
  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:py-12" aria-busy={loading || hasPendingOperation}>
      <header className="mb-3 max-w-3xl sm:mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">White-Gloss · Website</p>
        <h1 className="mt-2 font-display text-3xl sm:text-5xl">Website Studio</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted sm:mt-3">
          Inhalte bearbeiten, in Ruhe ansehen und bewusst veröffentlichen. Preise und Buchungsregeln
          werden hier nicht verändert.
        </p>
      </header>
      {navigation.status === "blocked" && (
        <section
          aria-label="Studio verlassen"
          className="mb-6 space-y-3 rounded-md border border-accent p-5"
        >
          <p>
            {hasPendingOperation
              ? "Eine Änderung wird noch gespeichert. Bitte warten Sie auf die Rückmeldung."
              : "Diese Seite enthält ungespeicherte Änderungen."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => navigation.reset?.()}>
              Im Studio bleiben
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={hasPendingOperation}
              onClick={() => navigation.proceed?.()}
            >
              Änderungen verwerfen und verlassen
            </Button>
          </div>
        </section>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <aside className="space-y-3 lg:sticky lg:top-20 lg:space-y-6">
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Seite bearbeiten</span>
            <select
              className={inputClass}
              value={key}
              disabled={hasPendingOperation}
              onChange={(event) => choose(event.target.value as CmsDocumentKey)}
            >
              {[...new Set(targets.map((item) => item.group))].map((group) => (
                <optgroup key={group} label={group}>
                  {targets
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                </optgroup>
              ))}
              {!targets.some((item) => item.key === key) && (
                <option value={key}>Neuer Eintrag</option>
              )}
            </select>
          </label>
          <details className="text-sm" open={initialKind === "faq" || initialKind === "blog"}>
            <summary className="min-h-11 cursor-pointer py-3 font-medium">
              Neuen Inhalt anlegen
            </summary>
            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createEntry();
              }}
            >
              <label className="block space-y-1">
                <span>Art</span>
                <select
                  className={inputClass}
                  value={newKind}
                  disabled={busy}
                  onChange={(event) => setNewKind(event.target.value as "faq" | "blog" | "service")}
                >
                  <option value="faq">Frage und Antwort</option>
                  <option value="blog">Ratgeber</option>
                  <option value="service">Zusatzleistung</option>
                </select>
              </label>
              {newKind === "service" && (
                <label className="block space-y-1">
                  <span>Name der Zusatzleistung</span>
                  <input
                    className={inputClass}
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    minLength={2}
                    maxLength={200}
                    required
                    disabled={busy}
                  />
                </label>
              )}
              <label className="block space-y-1">
                <span>Kurzer Seitenname</span>
                <input
                  className={inputClass}
                  placeholder="lackpflege-im-winter"
                  disabled={busy}
                  value={newSlug}
                  onChange={(event) => setNewSlug(event.target.value)}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={80}
                  required
                />
              </label>
              <Button type="submit" variant="ghost" disabled={busy}>
                {newKind === "service" ? "Zusatzleistung als Entwurf anlegen" : "Entwurf öffnen"}
              </Button>
            </form>
          </details>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-3 text-sm lg:block lg:space-y-2 lg:pt-5">
            <p>
              Entwurf:{" "}
              <strong>
                {document?.draftRevisionId
                  ? `Fassung ${document.draftRevisionId}`
                  : "noch nicht gespeichert"}
              </strong>
            </p>
            <p>
              Live:{" "}
              <strong>
                {document?.publishedRevisionId
                  ? `Fassung ${document.publishedRevisionId}`
                  : document?.published
                    ? "bestehender Inhalt"
                    : "Standardinhalt / noch unveröffentlicht"}
              </strong>
            </p>
            <p role="status" className="col-span-2 text-muted">
              {mediaActivity.dirty
                ? "Ungespeicherte Bildangaben – bitte in der Bilderverwaltung speichern"
                : dirty ? "Ungespeicherte Änderungen" : "Keine ungespeicherten Änderungen"}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Über-uns-Texte, Referenzen und Bildrechte bitte vor der Veröffentlichung persönlich
            prüfen. Unbekannte Angaben bleiben leer.
          </p>
        </aside>
        <div className="min-w-0 space-y-4 lg:space-y-6">
          {pendingKey && (
            <section
              aria-label="Ungespeicherte Änderungen"
              className="space-y-3 rounded-md border border-accent p-5"
            >
              <p>
                Die Änderungen sind noch nicht gespeichert. Möchten Sie auf dieser Seite bleiben?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setPendingKey(null)}>
                  Weiter bearbeiten
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (actionLock.current) return;
                    setKey(pendingKey);
                    setPendingKey(null);
                    setDirty(false);
                    setView("edit");
                  }}
                >
                  Änderungen verwerfen und wechseln
                </Button>
              </div>
            </section>
          )}
          {error && (
            <div
              role="alert"
              className="space-y-3 rounded-md border border-line p-4 text-sm text-danger"
            >
              <p>{error}</p>
              {loadFailed && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRetry((current) => current + 1)}
                >
                  Seite erneut laden
                </Button>
              )}
            </div>
          )}
          <p role="status" aria-live="polite" className="text-sm text-muted">
            {loading ? "Inhalt wird geladen …" : hasPendingOperation ? "Änderung wird geprüft …" : status}
          </p>
          <nav aria-label="Studio-Ansichten" className="flex flex-wrap gap-2 max-[359px]:gap-1">
            {(
              [
                ["edit", "Inhalt"],
                ["media", "Bilder"],
                ["preview", "Vorschau"],
                ["history", "Fassungen"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={view === value ? "primary" : "ghost"}
                className="px-2.5 max-[359px]:px-0.5 sm:px-5"
                aria-pressed={view === value}
                disabled={loading || hasPendingOperation || (value === "media" && document?.kind !== "page")}
                onClick={() => setView(value)}
              >
                {label}
              </Button>
            ))}
          </nav>
          <div hidden={view !== "media"}>
            <WebsiteStudioMedia
              onSelect={selectImage}
              onAssetsChanged={setAssets}
              onActivityChange={reportMediaActivity}
              disabled={unavailable}
            />
          </div>
          {document?.archived && (
            <section
              className="space-y-3 rounded-md border border-line p-5"
              aria-label="Zurückgezogener Inhalt"
            >
              <h2 className="font-display text-2xl">Inhalt zurückgezogen</h2>
              <p className="text-sm text-muted">
                Diese Seite hat keinen bearbeitbaren Entwurf. Wählen Sie eine frühere Fassung und
                stellen Sie sie als Entwurf wieder her. Die Website bleibt dabei unverändert.
              </p>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setView("history")}
              >
                Fassungen zum Wiederherstellen öffnen
              </Button>
            </section>
          )}
          {document && view === "edit" && !document.archived && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void action("save");
              }}
              className="space-y-8"
            >
              <fieldset disabled={unavailable} className="space-y-8">
                <WebsiteStudioFields
                  content={content}
                  assets={assets}
                  edit={edit}
                  openMedia={() => setView("media")}
                  simple={document.kind !== "page"}
                  leadLabel={document.kind === "blog" ? "Kurztext" : undefined}
                />
                <div className="flex flex-wrap gap-3">
                  <Button type="submit">Entwurf speichern</Button>
                  <Button type="button" variant="ghost" onClick={() => setView("preview")}>
                    Vorschau ansehen
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          {document && view === "preview" && (
            <section
              className="space-y-6 rounded-md border border-line bg-surface p-5 sm:p-8"
              aria-label="Geschützte Inhaltsvorschau"
            >
              <p className="text-sm text-muted">
                Geschützte Inhaltsvorschau ·{" "}
                {dirty ? "noch nicht gespeichert" : "gespeicherter Entwurf"}. Navigation, Preise und
                Buchung bleiben in der öffentlichen Seite erhalten.
              </p>
              <WebsiteStudioContent
                content={
                  document.kind === "page"
                    ? content
                    : { ...emptyCmsContent(), title: content.title, lead: document.kind === "blog" ? content.lead : "", body: content.body }
                }
                assets={assets}
                preview
                headingLevel={2}
              />
              <p className="border-t border-line pt-4 text-xs text-muted">
                Suchvorschau: {content.metaTitle || "Vorhandener Seitentitel"}
                <br />
                {content.metaDescription || "Vorhandene Beschreibung"}
              </p>
            </section>
          )}
          {document && view === "history" && (
            <section className="space-y-5">
              <h2 className="font-display text-2xl">Gespeicherte Fassungen</h2>
              <p className="text-sm text-muted">
                Wiederherstellen erstellt einen neuen Entwurf. Die öffentliche Fassung wird erst
                nach gesonderter Veröffentlichung geändert.
              </p>
              {document.revisions.length === 0 ? (
                <p className="text-sm text-muted">Noch keine Fassungen gespeichert.</p>
              ) : (
                <ol className="space-y-3">
                  {document.revisions.map((revision) => (
                    <li
                      key={revision.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-line p-4"
                    >
                      <div>
                        <p className="font-medium">
                          Fassung {revision.id}
                          {revision.id === document.publishedRevisionId ? " · Live" : ""}
                          {revision.id === document.draftRevisionId ? " · Entwurf" : ""}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {new Date(revision.createdAt).toLocaleString("de-DE", {
                            timeZone: "Europe/Berlin",
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy || dirty}
                        onClick={() => void action(revision.id)}
                      >
                        Als Entwurf wiederherstellen
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
              {dirty && (
                <p className="text-sm text-muted">
                  Bitte Änderungen speichern, bevor Sie eine frühere Fassung wiederherstellen.
                </p>
              )}
            </section>
          )}
          {document && (
            <section className="space-y-4 border-t border-line pt-6" aria-label="Veröffentlichung">
              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={!canPublish} onClick={() => setConfirm("publish")}>
                  Veröffentlichung prüfen
                </Button>
                <Button
                  type="button"
                  variant="line"
                  disabled={busy || dirty || (!document.published && !document.draft)}
                  onClick={() => setConfirm("archive")}
                >
                  Inhalt zurückziehen
                </Button>
              </div>
              {hasUnsavedChanges && (
                <p className="text-sm text-muted">
                  {mediaActivity.dirty
                    ? "Vor der Veröffentlichung bitte die geänderten Bildangaben in der Bilderverwaltung speichern."
                    : "Vor der Veröffentlichung bitte den Entwurf speichern."}
                </p>
              )}
              {confirm && (
                <div className="space-y-4 rounded-md border border-accent p-5">
                  <h2 className="font-display text-2xl">
                    {confirm === "publish"
                      ? `Fassung ${document.draftRevisionId} veröffentlichen?`
                      : "Redaktionellen Inhalt zurückziehen?"}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted">
                    {confirm === "publish"
                      ? "Die gespeicherte Fassung wird öffentlich sichtbar. Bitte Texte, Bildrechte und Vorschau zuvor prüfen."
                      : "Dieser redaktionelle Inhalt wird nicht mehr öffentlich angezeigt. Bestehende feste Inhalte der Website bleiben erhalten; Fassungen bleiben nachvollziehbar."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>
                      Abbrechen
                    </Button>
                    <Button type="button" disabled={busy} onClick={() => void action(confirm)}>
                      {confirm === "publish" ? "Jetzt veröffentlichen" : "Jetzt zurückziehen"}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

