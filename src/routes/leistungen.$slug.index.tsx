import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { WhatsAppPhotoCta } from "@/components/whatsapp-photo-cta";
import { ctaPrimary, PriceLine } from "@/components/ui";
import { cities, packageServiceSlug, packages, services, site } from "@/data/site";
import { serviceBookingSelection } from "@/lib/booking-selection";
import { pageHead } from "@/lib/seo";
import { eur, money } from "@/lib/utils";
import { ResultsTeaser } from "@/components/results-teaser";
import { serializeJsonLd } from "@/lib/json-ld";
import { ServicePriceNote } from "@/components/service-price-note";

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
  const request = serviceBookingSelection(s.slug);
  const pack = packages.find((p) => packageServiceSlug[p.id] === s.slug);
  const resultService =
    s.slug === "keramikversiegelung"
      ? "Keramikschutz"
      : s.slug === "innenraumreinigung" || s.slug === "lederpflege"
        ? "Innenraum"
        : s.slug === "lackkorrektur"
          ? "Lackkorrektur"
          : null;

  return (
    <main id="main-content" tabIndex={-1}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": s.pendingApproval ? "WebPage" : "Service",
            "@id": `${site.origin}/leistungen/${s.slug}#service`,
            name: s.title,
            url: `${site.origin}/leistungen/${s.slug}`,
            description: s.description,
            ...(!s.pendingApproval ? { provider: { "@type": "AutoRepair", "@id": `${site.origin}/#betrieb`, name: site.legalName }, areaServed: cities.map((city) => ({ "@type": "City", name: city.name })) } : {}),
          },
          { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Startseite", item: site.origin },
            { "@type": "ListItem", position: 2, name: "Leistungen", item: `${site.origin}/leistungen` },
            { "@type": "ListItem", position: 3, name: s.nav, item: `${site.origin}/leistungen/${s.slug}` },
          ] },
        ],
      }) }} />
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
        actions={s.pendingApproval ? <Link to="/kontakt" className={ctaPrimary}>Rückfrage zur Zulässigkeit</Link> :
          <Link
            to={request.leistung ? "/fahrzeug-zustand" : "/"}
            hash="buchung"
            search={request}
            className={ctaPrimary}
          >
            Termin anfragen
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {s.fromPrice ? (
          <p className="font-display text-4xl tracking-tight tabular-nums">
            ab {money(s.fromPrice)}&nbsp;€
            <span className="ml-3 text-sm font-sans text-subtle">{site.vatNote}</span>
          </p>
        ) : (
          <p className="text-sm uppercase tracking-[0.16em] text-subtle">{s.pendingApproval ? "Derzeit nicht buchbar" : "Preis nach Prüfung"}</p>
        )}
        <ServicePriceNote service={s} />
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
              <PriceLine key={row.name} name={row.name} price={row.price} note={row.note} />
            ))}
          </ul>
        ) : null}
        {s.steps ? (
          <ol className="mt-12 space-y-8">
            {s.steps.map((st, i) => (
              <li key={st.title} className="border-t border-line pt-6">
                <p className="font-display text-3xl tracking-tight text-subtle/80">0{i + 1}</p>
                <h2 className="mt-2 font-display text-2xl tracking-tight">{st.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{st.text}</p>
              </li>
            ))}
          </ol>
        ) : null}
        {pack ? (
          <p className="mt-10 border border-line bg-surface p-5 text-sm leading-relaxed">
            Paket {pack.name} ab {eur(pack.price)} {site.vatNote} · {pack.duration.replace(/\.$/, "")}.
          </p>
        ) : null}
        {resultService ? <ResultsTeaser service={resultService} /> : null}
        <WhatsAppPhotoCta className="mt-12" />
        <h2 className="mt-16 font-display text-3xl tracking-tight">
          Hol- und Bringservice nach Stadt
        </h2>
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
