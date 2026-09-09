import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { cities, packages, pickupKeramikNote, pickupPriceText, services, site } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { eur } from "@/lib/utils";

export const Route = createFileRoute("/leistungen/$slug/$city")({
  loader: ({ params }) => {
    const service = services.find((s) => s.slug === params.slug);
    const city = cities.find((c) => c.slug === params.city);
    if (!service || !city) throw notFound();
    return { service, city };
  },
  head: ({ loaderData }) => {
    const service = loaderData?.service;
    const city = loaderData?.city;
    if (!service || !city) return {};
    return pageHead({
      title: `${service.seoNav} ${city.name} | White Gloss`,
      description: `${service.seoNav} mit Hol- und Bringservice aus ${city.name}. Ausführung in der Werkstatt in Horb am Neckar. ${pickupPriceText(city.km)}.`,
      path: `/leistungen/${service.slug}/${city.slug}`,
    });
  },
  component: ServiceCityPage,
});

function ServiceCityPage() {
  const { service, city } = Route.useLoaderData();
  const otherCities = cities.filter((c) => c.slug !== city.slug);
  const otherServices = services.filter((s) => s.slug !== service.slug);
  const pickup = pickupPriceText(city.km);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: `${service.seoNav} ${city.name}`,
        provider: {
          "@type": "AutoRepair",
          name: site.legalName,
          address: {
            "@type": "PostalAddress",
            streetAddress: site.street,
            postalCode: site.postalCode,
            addressLocality: site.city,
            addressCountry: "DE",
          },
        },
        areaServed: city.name,
        description: service.description,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Startseite", item: site.origin },
          { "@type": "ListItem", position: 2, name: "Leistungen", item: `${site.origin}/leistungen` },
          {
            "@type": "ListItem",
            position: 3,
            name: service.seoNav,
            item: `${site.origin}/leistungen/${service.slug}`,
          },
          {
            "@type": "ListItem",
            position: 4,
            name: city.name,
            item: `${site.origin}/leistungen/${service.slug}/${city.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <main id="main-content">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHero
        src={service.image}
        alt={service.imageAlt}
        kicker={`${city.name} · ${city.km} km`}
        title={`${service.nav} in ${city.name}`}
        lead={service.teaser}
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Leistungen", to: "/leistungen" },
          { label: service.nav, to: `/leistungen/${service.slug}` },
          { label: city.name },
        ]}
        actions={
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Abholung anfragen
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="rounded-card border border-line bg-surface p-4 text-sm">
          Hol- und Bringservice aus {city.name}: {pickup}. {pickupKeramikNote()}.
          Die Aufbereitung erfolgt in unserer Werkstatt: {site.street}, {site.postalCode} {site.city}.
        </p>
        <ul className="mt-8 space-y-3">
          {service.bullets.map((b) => (
            <li key={b} className="border-l border-line pl-4 text-sm text-fg">
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-8 space-y-4 leading-relaxed text-muted">
          {service.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p>
            Aus {city.name} beträgt die Fahrt rund {city.minutes} Minuten. Sie übergeben das
            Fahrzeug an der vereinbarten Adresse; die Rückgabe erfolgt nach der Kontrolle unter
            Werkstattlicht.
          </p>
        </div>
        {service.slug === "keramikversiegelung" ? (
          <p className="mt-8 text-sm">
            Paket Keramikschutz ab {eur(packages[2].price)} {site.vatNote}, {pickupKeramikNote()}.
          </p>
        ) : null}
        <Link
          to="/"
          hash="buchung"
          className="mt-10 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-fg"
        >
          Abholung aus {city.name} anfragen
        </Link>
        <h2 className="mt-16 font-display text-2xl">Weitere Leistungen für {city.name}</h2>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-muted">
          {otherServices.map((s) => (
            <li key={s.slug}>
              <Link
                to="/leistungen/$slug/$city"
                params={{ slug: s.slug, city: city.slug }}
                className="hover:text-fg"
              >
                {s.nav}
              </Link>
            </li>
          ))}
        </ul>
        <h2 className="mt-12 font-display text-2xl">{service.nav} in der Region</h2>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-muted">
          {otherCities.map((c) => (
            <li key={c.slug}>
              <Link
                to="/leistungen/$slug/$city"
                params={{ slug: service.slug, city: c.slug }}
                className="hover:text-fg"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
