import { createFileRoute } from "@tanstack/react-router";
import { CmsEditor } from "@/components/cms-editor";
import { faqs } from "@/data/site";

export const Route = createFileRoute("/admin/faqs")({
  component: AdminFaqs,
});

function AdminFaqs() {
  return (
    <div>
      <CmsEditor
        kind="faq"
        kicker="Angebot & Website"
        heading="Häufige Fragen"
        hint="Zusätzliche Fragen erscheinen auf der öffentlichen FAQ-Seite und im FAQ-Schema. Die Stammfragen bleiben fest – so bleibt die Seite auch ohne Datenbank vollständig."
        extraLabel="Gruppe"
      />
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <h2 className="font-display text-2xl">Stammfragen</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {faqs.map((f) => (
            <li key={f.q}>
              {f.group}: {f.q}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
