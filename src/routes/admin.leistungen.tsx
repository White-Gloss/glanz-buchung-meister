import { createFileRoute } from "@tanstack/react-router";
import { CmsEditor } from "@/components/cms-editor";
import { packages, services } from "@/data/site";
import { eur } from "@/lib/utils";

export const Route = createFileRoute("/admin/leistungen")({
  component: AdminServices,
});

function AdminServices() {
  return (
    <div>
      <CmsEditor
        kind="service"
        kicker="Angebot & Website"
        heading="Dienstleistungen"
        hint="Die Kernpakete bleiben fest in der Website (schnelle Auslieferung). Hier legen Sie zusätzliche Leistungen an, die auf der Leistungsseite erscheinen."
        slugField
      />
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <h2 className="font-display text-2xl">Live auf der Website</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {packages.map((p) => (
            <li key={p.id}>
              Paket {p.name} · ab {eur(p.price)}
            </li>
          ))}
          {services.map((s) => (
            <li key={s.slug}>
              Seite /leistungen/{s.slug} · {s.nav}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
