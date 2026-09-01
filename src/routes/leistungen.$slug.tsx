import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FluidImg } from "@/components/media";
import { ctaPrimary, PriceLine } from "@/components/ui";
import { cities, packages, services, site } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { eur } from "@/lib/utils";

export const Route = createFileRoute("/leistungen/$slug")({
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
  return (
    <main id="main-content">
      <FluidImg
        src={s.image}
        alt={s.imageAlt}
        priority
        className="h-[42vh] min-h-64 w-full object-cover"
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Leistung</p>
        <h1 className="mt-3 font-display text-5xl">{s.title}</h1>
        <p className="mt-4 text-lg text-muted">{s.description}</p>
        <ul className="mt-8 space-y-3">
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
          <p className="mt-8 rounded-card border border-line bg-surface p-4 text-sm leading-relaxed text-fg">
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
          <ol className="mt-10 space-y-5">
            {s.steps.map((st, i) => (
              <li key={st.title}>
                <p className="text-xs text-subtle">0{i + 1}</p>
                <h2 className="font-display text-2xl">{st.title}</h2>
                <p className="mt-1 text-sm text-muted">{st.text}</p>
              </li>
            ))}
          </ol>
        ) : null}
        {s.slug === "keramikversiegelung" ? (
          <p className="mt-8 rounded-card border border-line bg-surface p-4 text-sm">
            Paket Keramik ab {eur(packages[2].price)} {site.vatNote} · ca. 2 Tage.
          </p>
        ) : null}
        <Link
          to="/"
          hash="buchung"
          className={`mt-10 ${ctaPrimary}`}
        >
          Zum Preisrechner
        </Link>
        <h2 className="mt-16 font-display text-2xl">Hol- & Bringservice nach Stadt</h2>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-muted">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                to="/leistungen/$slug/$city"
                params={{ slug: s.slug, city: c.slug }}
                className="hover:text-fg"
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
