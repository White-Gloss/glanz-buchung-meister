import { createFileRoute } from "@tanstack/react-router";
import { CmsEditor } from "@/components/cms-editor";
import { articles } from "@/data/ratgeber";

export const Route = createFileRoute("/admin/blog")({
  component: AdminBlog,
});

function AdminBlog() {
  return (
    <div>
      <CmsEditor
        kind="blog"
        kicker="Angebot & Website"
        heading="Ratgeber"
        hint="Neue Beiträge brauchen einen Slug (URL-Teil). Sie erscheinen im Ratgeber und sind indexierbar."
        slugField
        extraLabel="Kurztext"
      />
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <h2 className="font-display text-2xl">Bestehende Beiträge</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {articles.map((a) => (
            <li key={a.slug}>
              /ratgeber/{a.slug} · {a.title}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
