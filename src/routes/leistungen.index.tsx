import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowRight } from "@/components/icons";
import { MediaTile, PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { cities, services, site } from "@/data/site";
import { listPublishedCms } from "@/lib/cms.functions";
import { pageHead } from "@/lib/seo";
import { money } from "@/lib/utils";

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
  const atelier = services.filter((s) => s.group === "atelier");
  const finish = services.filter((s) => s.group === "finish");

  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="lack"
        alt="Poliermaschine auf dem Lack in der Werkstatt Horb"
        kicker="Leistungsspektrum"
        title="Was wir am Auto machen."
        lead="Kein Waschstraßenprogramm. Innenraum, Lack, Keramik, Leder und Dellen – in der Werkstatt in Horb, ein Auto nach dem anderen."
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
        <div className="section mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-4">
          <p className="kicker">Atelier</p>
          <h2 className="heading-2 mt-4 max-w-xl">Die Arbeit am Auto.</h2>
        </div>
        <div className="gd-split gd-split--duo">
          {atelier.map((s) => (
            <Link
              key={s.slug}
              to="/leistungen/$slug"
              params={{ slug: s.slug }}
              className="block border-b border-line lg:odd:border-r"
            >
              <MediaTile src={s.image} alt={s.imageAlt}>
                <h2 className="heading-2 max-w-md">{s.nav}</h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
                  {s.teaser}
                </p>
                {s.fromPrice ? (
                  <p className="mt-4 font-display text-2xl tracking-tight tabular-nums">
                    ab {money(s.fromPrice)} €
                  </p>
                ) : null}
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
                Nicht über den Rechner. Erst am Telefon, dann am Auto.
              </p>
            </MediaTile>
          </Link>
        </div>
      </section>

      <section className="section mx-auto max-w-7xl px-4 sm:px-6">
        <p className="kicker">Nacharbeit</p>
        <h2 className="heading-2 mt-4 max-w-xl">Dellen, Leder, Licht, Geruch.</h2>
        <ol className="mt-12 divide-y divide-line border-y border-line">
          {finish.map((s, i) => (
            <li key={s.slug}>
              <Link
                to="/leistungen/$slug"
                params={{ slug: s.slug }}
                className="lift group gd-pack py-8"
              >
                <span className="ga-num font-display text-sm text-subtle tabular-nums">
                  {String(i + 1).padStart(2, "0")}.
                </span>
                <span className="ga-pack-copy">
                  <span className="font-display text-3xl tracking-tight sm:text-4xl">
                    {s.nav}
                  </span>
                  <span className="mt-2 block max-w-lg text-sm leading-relaxed text-muted">
                    {s.teaser}
                  </span>
                </span>
                <span className="ga-price">
                  {s.fromPrice ? (
                    <span className="flex items-baseline gap-2 sm:justify-end">
                      <span className="text-[0.65rem] uppercase tracking-[0.2em] text-subtle">ab </span>
                      <span className="font-display text-3xl leading-none tracking-wide tabular-nums">
                        {money(s.fromPrice)}
                      </span>
                      <span className="text-sm text-muted"> €</span>
                    </span>
                  ) : (
                    <span className="text-sm text-subtle">nach Prüfung</span>
                  )}
                  <span className="mt-1 block text-xs text-subtle">{site.vatNote}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
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
