import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary, PriceLine } from "@/components/ui";
import {
  cities,
  packageServiceSlug,
  packages,
  services,
  site,
} from "@/data/site";
import { pageHead } from "@/lib/seo";
import { eur, money } from "@/lib/utils";

export const Route = createFileRoute("/leistungen/$slug/")({
  component: ServicePage,
  loader: ({ params }) => {
    const service = services.find((s) => s.slug === params.slug);
    if (!service) throw notFound();
    return service;
  },
  head: ({ loaderData }) =>
    pageHead({
      title: loaderData?.metaTitle ?? site.name,
      description: loaderData?.description ?? "",
      path: `/leistungen/${loaderData?.slug ?? ""}`,
    }),
});

function ServicePage() {
  const s = Route.useLoaderData();
  const pack = packages.find((p) => packageServiceSlug[p.id] === s.slug);

  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        src={s.image}
        alt={s.imageAlt}
        kicker="Leistung"
        title={s.title}
        lead={s.teaser}
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Leistungen", to: "/leistungen" },
          { label: s.nav },
        ]}
        actions={
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Termin anfragen
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {s.fromPrice ? (
          <p className="font-display text-4xl tracking-tight tabular-nums">
            ab {money(s.fromPrice)} €
            <span className="ml-3 text-sm font-sans text-subtle">{site.vatNote}</span>
          </p>
        ) : (
          <p className="text-sm uppercase tracking-[0.16em] text-subtle">Preis nach Prüfung</p>
        )}
        <ul className="mt-10 space-y-3">
          {s.bullets.map((b) => (
            <li key={b} className="border-l border-line pl-4 text-sm text-fg">
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-8 space-y-4 text-muted leading-relaxed">
          {s.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        {s.honestNote ? (
          <p className="mt-8 border border-line bg-surface p-5 text-sm leading-relaxed text-fg">
            {s.honestNote}
          </p>
        ) : null}
        {s.priceRows ? (
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {s.priceRows.map((row) => (
              <PriceLine
                key={row.name}
                name={row.name}
                price={row.price}
                note={row.note}
              />
            ))}
          </ul>
        ) : null}
        {s.steps ? (
          <ol className="mt-12 space-y-8">
            {s.steps.map((st, i) => (
              <li key={st.title} className="border-t border-line pt-6">
                <p className="font-display text-3xl tracking-tight text-subtle/80">
                  0{i + 1}
                </p>
                <h2 className="mt-2 font-display text-2xl tracking-tight">{st.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{st.text}</p>
              </li>
            ))}
          </ol>
        ) : null}
        {pack ? (
          <p className="mt-10 border border-line bg-surface p-5 text-sm leading-relaxed">
            Paket {pack.name} ab {eur(pack.price)} {site.vatNote} · {pack.duration}.
          </p>
        ) : null}
        <h2 className="mt-16 font-display text-3xl tracking-tight">Hol- und Bringservice nach Stadt</h2>
        <ul className="mt-6 grid grid-cols-2 gap-x-8 text-sm text-muted">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                to="/leistungen/$slug/$city"
                params={{ slug: s.slug, city: c.slug }}
                className="inline-flex min-h-11 items-center hover:text-fg"
              >
                {s.nav} {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
