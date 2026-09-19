import {
  heroAvifSrcSet,
  heroPreloadMobile,
  heroPreloadWide,
  logoJsonLdHref,
} from "@/data/media-src";
import {
  cities,
  openingHours,
  packageAnchor,
  packageServiceSlug,
  packages,
  services,
  site,
} from "@/data/site";

export function absUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${site.origin}${p}`;
}

const DEFAULT_ROBOTS = "index,follow,max-image-preview:large";
const OG_IMAGE = "/media/hero.jpg";

export function pageHead(opts: {
  title: string;
  description: string;
  path: string;
  robots?: string;
  preloadImage?: string;
  preloadType?: string;
  preloadSrcSet?: string;
  preloadSizes?: string;
  preloadHero?: boolean;
  preloadShot?:
    | "keramik"
    | "lack"
    | "atelier"
    | "dellen"
    | "finish"
    | "felgen"
    | "leder"
    | "private";
}) {
  const canonical = absUrl(opts.path);
  const ogImage = absUrl(OG_IMAGE);
  const shotPreload = opts.preloadShot
    ? {
        rel: "preload" as const,
        as: "image",
        href: `/media/${opts.preloadShot}-800.avif`,
        type: "image/avif",
        imageSrcSet: `/media/${opts.preloadShot}-480.avif 480w, /media/${opts.preloadShot}-800.avif 800w, /media/${opts.preloadShot}-1200.avif 1200w`,
        imageSizes: "100vw",
        fetchPriority: "high" as const,
      }
    : null;
  const preload = opts.preloadHero
    ? [
        {
          rel: "preload" as const,
          as: "image",
          href: heroPreloadMobile,
          type: "image/avif",
          media: "(max-width: 767px)",
          imageSrcSet: heroAvifSrcSet,
          imageSizes: "100vw",
          fetchPriority: "high" as const,
        },
        {
          rel: "preload" as const,
          as: "image",
          href: heroPreloadWide,
          type: "image/avif",
          media: "(min-width: 768px)",
          imageSrcSet: heroAvifSrcSet,
          imageSizes: "100vw",
          fetchPriority: "high" as const,
        },
      ]
    : shotPreload
      ? [shotPreload]
      : opts.preloadImage
        ? [
            {
              rel: "preload" as const,
              as: "image",
              href: opts.preloadImage,
              fetchPriority: "high" as const,
              ...(opts.preloadType ? { type: opts.preloadType } : {}),
              ...(opts.preloadSrcSet ? { imageSrcSet: opts.preloadSrcSet } : {}),
              ...(opts.preloadSizes ? { imageSizes: opts.preloadSizes } : {}),
            },
          ]
        : [];
  return {
    meta: [
      { title: opts.title },
      { name: "description", content: opts.description },
      { name: "robots", content: opts.robots ?? DEFAULT_ROBOTS },
      { name: "geo.region", content: "DE-BW" },
      { name: "geo.placename", content: site.city },
      { name: "geo.position", content: `${site.lat};${site.lng}` },
      { name: "ICBM", content: `${site.lat}, ${site.lng}` },
      { name: "author", content: site.legalName },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "de_DE" },
      { property: "og:site_name", content: site.legalName },
      { property: "og:title", content: opts.title },
      { property: "og:description", content: opts.description },
      { property: "og:url", content: canonical },
      { property: "og:image", content: ogImage },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1600" },
      { property: "og:image:height", content: "907" },
      { property: "og:image:alt", content: opts.title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: opts.title },
      { name: "twitter:description", content: opts.description },
      { name: "twitter:image", content: ogImage },
    ],
    links: [
      { rel: "canonical", href: canonical },
      { rel: "alternate", hrefLang: "de-DE", href: canonical },
      { rel: "alternate", hrefLang: "x-default", href: canonical },
      ...preload,
    ],
  };
}

export function localBusinessJsonLd() {
  const businessId = `${site.origin}/#betrieb`;
  const websiteId = `${site.origin}/#website`;
  const catalogServices = [
    "innenraumreinigung",
    "lackkorrektur",
    "keramikversiegelung",
    "lederpflege",
    "lederreparatur",
    "geruchsneutralisation",
    "scheinwerferaufbereitung",
  ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: site.origin,
        name: site.legalName,
        inLanguage: "de-DE",
        publisher: { "@id": businessId },
      },
      {
        "@type": ["AutoRepair", "AutomotiveBusiness"],
        "@id": businessId,
        name: site.legalName,
        image: absUrl("/media/hero-1080.webp"),
        logo: {
          "@type": "ImageObject",
          url: absUrl(logoJsonLdHref),
          width: 760,
          height: 437,
        },
        url: site.origin,
        telephone: "+4915233540284",
        email: site.email,
        priceRange: "€€€",
        currenciesAccepted: "EUR",
        paymentAccepted: "Cash, Bank Transfer",
        description:
          "Fahrzeugaufbereitung in Horb am Neckar: Innenraumreinigung, Lackkorrektur, Keramikversiegelung und Hol- und Bringservice.",
        address: {
          "@type": "PostalAddress",
          streetAddress: site.street,
          postalCode: site.postalCode,
          addressLocality: site.city,
          addressRegion: site.region,
          addressCountry: "DE",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: site.lat,
          longitude: site.lng,
        },
        hasMap: site.mapsGoogle,
        // Der Betrieb wird vom Inhaber persönlich geführt; die Angabe deckt
        // sich zeichengenau mit dem Impressum.
        founder: { "@type": "Person", name: site.owner },
        knowsLanguage: "de-DE",
        // Ein ausgewiesener Kontaktweg macht aus Nummer und Adresse eine
        // Angabe, die Google einer Zuständigkeit zuordnen kann.
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          telephone: "+4915233540284",
          email: site.email,
          areaServed: "DE",
          availableLanguage: "German",
        },
        areaServed: cities.map((c) => ({
          "@type": "City",
          name: c.name,
        })),
        sameAs: [site.instagram],
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [...openingHours.dayOfWeek],
            opens: openingHours.opens,
            closes: openingHours.closes,
          },
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Fahrzeugaufbereitung",
          itemListElement: [
            ...packages.map((p) => ({
              "@type": "Offer",
              name: `${p.searchLabel} ${p.name}`,
              itemOffered: {
                "@type": "Service",
                name: p.seoName,
                alternateName: [p.name, p.searchLabel],
                description: p.body,
                url: absUrl(`/leistungen/${packageServiceSlug[p.id]}`),
                areaServed: site.city,
                provider: { "@type": "AutomotiveBusiness", name: site.legalName },
              },
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: String(p.price),
                priceCurrency: "EUR",
                valueAddedTaxIncluded: true,
              },
              url: absUrl(`/preise#${packageAnchor(p.id)}`),
            })),
            ...catalogServices
              .filter((slug) => !Object.values(packageServiceSlug).includes(slug))
              .map((slug) => {
                const svc = services.find((s) => s.slug === slug);
                return {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: svc?.nav ?? slug,
                    url: absUrl(`/leistungen/${slug}`),
                  },
                  url: absUrl(`/leistungen/${slug}`),
                };
              }),
          ],
        },
      },
    ],
  };
}
