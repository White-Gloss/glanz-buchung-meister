import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FluidImg } from "@/components/media";
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
      title: `${service.nav} ${city.name} | White Gloss`,
      description: `${service.nav} mit Hol- und Bringservice aus ${city.name}. Ausführung in der Werkstatt in Horb am Neckar. ${pickupPriceText(city.km)}.`,
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
        name: `${service.nav} ${city.name}`,
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
            name: service.nav,
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
      <FluidImg
        src={service.image}
        alt={service.imageAlt}
        priority
        className="h-[38vh] min-h-56 w-full object-cover"
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <nav aria-label="Brotkrumen" className="text-xs text-subtle">
          <Link to="/" className="hover:text-fg">
            Startseite
          </Link>
          <span className="px-2">/</span>
          <Link to="/leistungen" className="hover:text-fg">
            Leistungen
          </Link>
          <span className="px-2">/</span>
          <Link to="/leistungen/$slug" params={{ slug: service.slug }} className="hover:text-fg">
            {service.nav}
          </Link>
        </nav>
        <p className="mt-6 text-xs uppercase tracking-[0.16em] text-subtle">
          {city.name} · ca. {city.km} km · ca. {city.minutes} Min.
        </p>
        <h1 className="mt-3 font-display text-5xl">
          {service.nav} in {city.name}
        </h1>
        <p className="mt-4 text-lg text-muted">
          White Gloss holt Fahrzeuge in {city.name} ab und bereitet sie in der Werkstatt in{" "}
          {site.city} auf. {city.blurb}
        </p>
        <p className="mt-4 rounded-md border border-line bg-surface p-4 text-sm">
          Hol- & Bringservice aus {city.name}: {pickup}. {pickupKeramikNote()}.
          Ausführung immer in {site.street}, {site.postalCode} {site.city}.
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
            Paket Keramik ab {eur(packages[2].price)} {site.vatNote}, {pickupKeramikNote()}.
          </p>
        ) : null}
        <Link
          to="/"
          hash="buchung"
          className="mt-10 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-fg"
        >
          Abholung aus {city.name} anfragen
        </Link>
        <h2 className="mt-16 font-display text-2xl">Weitere Leistungen in {city.name}</h2>
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
