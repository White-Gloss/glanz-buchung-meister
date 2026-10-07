import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowRight } from "@/components/icons";
import { MediaTile, PageHero } from "@/components/page-hero";
import { WhatsAppPhotoCta } from "@/components/whatsapp-photo-cta";
import { ctaPrimary } from "@/components/ui";
import { cities, services, site } from "@/data/site";
import { listPublishedCms } from "@/lib/cms.functions";
import { pageHead } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/json-ld";
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
        "Autoaufbereitung in Horb am Neckar: Innenraumreinigung, Lackkorrektur, Keramikversiegelung, Lederreparatur, Smart Repair und Leasingrückgabe.",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Startseite", item: site.origin },
              {
                "@type": "ListItem",
                position: 2,
                name: "Leistungen",
                item: `${site.origin}/leistungen`,
              },
            ],
          }),
        }}
      />
      <PageHero
        shot="lack"
        alt="Poliermaschine auf dem Lack in der Werkstatt Horb"
        kicker="Leistungsspektrum"
        title="Leistungen der Fahrzeugaufbereitung."
        lead="Autoaufbereitung in unserer Werkstatt in Horb am Neckar: Innenraumreinigung, Lackpflege, Keramikversiegelung und Reparaturen."
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
          <p className="kicker">Fahrzeugpflege</p>
          <h2 className="heading-2 mt-4 max-w-xl">Reinigung, Politur und Schutz</h2>
        </div>
        <div className="gd-split gd-split--duo">
          {atelier.map((s) => (
            <article
              key={s.slug}
              className="group relative block border-b border-line lg:odd:border-r"
            >
              <MediaTile src={s.image} alt={s.imageAlt}>
                <h3 className="heading-2 max-w-md">
                  <Link
                    to="/leistungen/$slug"
                    params={{ slug: s.slug }}
                    className="after:absolute after:inset-0 hover:underline"
                  >
                    {s.nav}
                  </Link>
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
                  {s.teaser}
                </p>
                {s.fromPrice ? (
                  <p className="mt-4 font-display text-2xl tracking-tight tabular-nums">
                    ab {money(s.fromPrice)}&nbsp;€<span className="mt-1 block font-sans text-xs text-muted">{site.vatNote}</span>
                  </p>
                ) : null}
                <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-fg" aria-hidden="true">
                  Zur Leistung
                  <IconArrowRight className="link-arrow size-4" />
                </span>
              </MediaTile>
            </article>
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
          <article className="group relative block border-b border-line lg:odd:border-r">
            <MediaTile shot="private" alt="Freigegebenes Kundenfahrzeug nach der Aufbereitung bei White Gloss">
              <p className="kicker">Luxusfahrzeuge</p>
              <h2 className="heading-2 mt-3 max-w-md">
                <Link
                  to="/luxusfahrzeuge"
                  className="after:absolute after:inset-0 hover:underline"
                >
                  Luxusfahrzeuge ab ca. 80.000&nbsp;€
                </Link>
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
                Telefonische Beratung und anschließende Begutachtung vor Ort.
              </p>
            </MediaTile>
          </article>
        </div>
      </section>

      <section className="section mx-auto max-w-7xl px-4 sm:px-6">
        <p className="kicker">Nacharbeit</p>
        <h2 className="heading-2 mt-4 max-w-xl">Reparaturen und weitere Pflegeleistungen</h2>
        <ol className="mt-12 divide-y divide-line border-y border-line">
          {finish.map((s, i) => (
            <li key={s.slug}>
              <div className="lift group relative gd-pack py-8">
                <span className="ga-num font-display text-sm text-subtle tabular-nums">
                  {String(i + 1).padStart(2, "0")}.
                </span>
                <span className="ga-pack-copy">
                  <span className="font-display text-3xl tracking-tight sm:text-4xl">
                    <Link
                      to="/leistungen/$slug"
                      params={{ slug: s.slug }}
                      className="after:absolute after:inset-0 hover:underline"
                    >
                      {s.nav}
                    </Link>
                  </span>
                  <span className="mt-2 block max-w-lg text-sm leading-relaxed text-muted">
                    {s.teaser}
                  </span>
                </span>
                <span className="ga-price">
                  {s.fromPrice ? (
                    <span className="flex items-baseline gap-2 sm:justify-end">
                      <span className="text-xs uppercase tracking-[0.2em] text-subtle">ab </span>
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
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-8">
        <WhatsAppPhotoCta />
      </section>

      <section className="section mx-auto max-w-7xl px-4 sm:px-6">
        <p className="kicker">{cities.length} Abholorte</p>
        <h2 className="heading-2 mt-4">Leistungen nach Stadt</h2>
        <p className="mt-4 max-w-2xl text-muted">
          Wählen Sie Ihren Ort und informieren Sie sich über unsere Leistungen
          und die Abholung. Die Aufbereitung erfolgt in Horb am Neckar.
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                to="/abholservice/$city"
                params={{ city: c.slug }}
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
