import { createFileRoute, Link } from "@tanstack/react-router";
import { FluidImg } from "@/components/media";
import { cities, services, site } from "@/data/site";
import { listPublishedCms } from "@/lib/cms.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/leistungen/")({
  loader: async () => {
    try {
      return { extra: await listPublishedCms({ data: { kind: "service" } }) };
    } catch {
      return { extra: [] as Awaited<ReturnType<typeof listPublishedCms>> };
    }
  },
  component: LeistungenIndex,
  head: () =>
    pageHead({
      title: `Leistungen der Fahrzeugaufbereitung | ${site.name}`,
      description:
        "Leistungen in Horb am Neckar: Innenraumreinigung, Lackkorrektur, Keramikversiegelung, Lederreparatur, Smart Repair und Leasingrückgabe.",
      path: "/leistungen",
    }),
});

function LeistungenIndex() {
  const { extra } = Route.useLoaderData();
  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <p className="kicker">Leistungsspektrum</p>
      <h1 className="heading-1 mt-4">
        Was wir am Auto machen.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Hier finden Sie Innenraumreinigung, Lackkorrektur, Keramikversiegelung,
        Lederreparatur und die übrigen Leistungen – jeweils mit Ablauf,
        Startpreisen und Abholung nach Stadt.
      </p>
      <div className="gd-tiles mt-12">
        {services.map((s) => (
          <Link
            key={s.slug}
            to="/leistungen/$slug"
            params={{ slug: s.slug }}
            className="overflow-hidden border border-line bg-surface"
          >
            <FluidImg
              src={s.image}
              alt={s.imageAlt}
              className="aspect-[16/9] w-full object-cover"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
            <div className="p-5">
              <h2 className="font-display text-2xl">{s.nav}</h2>
              <p className="mt-2 text-sm text-muted">{s.description}</p>
            </div>
          </Link>
        ))}
        {extra.map((row) => (
          <article key={row.id} className="rounded-card border border-line bg-surface p-6">
            <h2 className="font-display text-2xl">{row.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{row.body}</p>
          </article>
        ))}
        <Link
          to="/luxusfahrzeuge"
          className="overflow-hidden border border-line bg-surface"
        >
          <FluidImg
            src="/media/hero.webp"
            alt="Atelierfahrzeug von White Gloss, Kennzeichen entfernt"
            className="aspect-[16/9] w-full object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
          <div className="p-5">
            <p className="kicker">Private Client</p>
            <h2 className="mt-2 font-display text-2xl">
              Luxusfahrzeuge ab ca. 80.000 €
            </h2>
            <p className="mt-2 text-sm text-muted">
              Nicht über den Rechner, sondern erst am Telefon und dann am Auto.
              Optional mit Systemen wie Swissvax, wenn sie zum Lack passen.
            </p>
          </div>
        </Link>
      </div>
      <h2 className="mt-16 font-display text-3xl">Leistungen nach Stadt</h2>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Für jede Leistung und jeden Abholort gibt es eine eigene Seite – damit
        Sie uns in Tübingen, Nagold, Freudenstadt oder Böblingen ebenso finden
        wie in Horb am Neckar.
      </p>
      <ul className="mt-6 flex flex-wrap gap-2 text-sm">
        {cities.map((c) => (
          <li key={c.slug}>
            <Link
              to="/leistungen/$slug/$city"
              params={{ slug: "fahrzeugaufbereitung", city: c.slug }}
              className="inline-flex min-h-11 items-center rounded-sm border border-line px-3 text-muted hover:text-fg"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
