import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowRight } from "@/components/icons";
import { MediaTile, PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
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
      preloadShot: "lack",
    }),
});

function LeistungenIndex() {
  const { extra } = Route.useLoaderData();
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="lack"
        alt="Poliermaschine auf dem Lack in der Werkstatt Horb"
        kicker="Leistungsspektrum"
        title="Was wir am Auto machen."
        lead="Innenraumreinigung, Lackkorrektur, Keramikversiegelung, Lederreparatur und die übrigen Leistungen – jeweils mit Ablauf, Startpreisen und Abholung nach Stadt."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Leistungen" },
        ]}
        actions={
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Termin anfragen
            <IconArrowRight className="size-4" />
          </Link>
        }
      />
      <section className="border-t border-line">
        <div className="gd-split gd-split--duo">
          {services.map((s) => (
            <Link
              key={s.slug}
              to="/leistungen/$slug"
              params={{ slug: s.slug }}
              className="block border-b border-line lg:odd:border-r"
            >
              <MediaTile src={s.image} alt={s.imageAlt}>
                <h2 className="heading-2 max-w-md">{s.nav}</h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
                  {s.description}
                </p>
                <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-fg">
                  Zur Leistung
                  <IconArrowRight className="link-arrow size-4" />
                </span>
              </MediaTile>
            </Link>
          ))}
          {extra.map((row) => (
            <article
              key={row.id}
              className="border-b border-line p-8 lg:odd:border-r"
            >
              <h2 className="heading-2">{row.title}</h2>
              <p className="mt-3 max-w-md whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {row.body}
              </p>
            </article>
          ))}
          <Link
            to="/luxusfahrzeuge"
            className="block border-b border-line lg:odd:border-r"
          >
            <MediaTile shot="private" alt="Atelierfahrzeug von White Gloss, Kennzeichen entfernt">
              <p className="kicker">Private Client</p>
              <h2 className="heading-2 mt-3 max-w-md">
                Luxusfahrzeuge ab ca. 80.000 €
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
                Nicht über den Rechner, sondern erst am Telefon und dann am Auto.
                Optional mit Systemen wie Swissvax, wenn sie zum Lack passen.
              </p>
            </MediaTile>
          </Link>
        </div>
      </section>
      <section className="section mx-auto max-w-7xl px-4 sm:px-6">
        <p className="kicker">13 Städte</p>
        <h2 className="heading-2 mt-4">Leistungen nach Stadt</h2>
        <p className="mt-4 max-w-2xl text-muted">
          Für jede Leistung und jeden Abholort gibt es eine eigene Seite – damit
          Sie uns in Tübingen, Nagold, Freudenstadt oder Böblingen ebenso finden
          wie in Horb am Neckar.
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                to="/leistungen/$slug/$city"
                params={{ slug: "fahrzeugaufbereitung", city: c.slug }}
                className="inline-flex min-h-11 items-center border border-line px-4 text-sm text-muted hover:text-fg"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
