import type { City } from "@/data/site";
import { openingHours, site } from "@/data/site";
import { absUrl } from "@/lib/seo";

export function cityPath(city: City) {
  return `/abholservice/${city.slug}`;
}

export function whatsappForCity(cityName: string) {
  const text = `Hallo White Gloss, ich interessiere mich für eine Fahrzeugaufbereitung in ${cityName} und würde den Aufwand gern anhand von Fotos einschätzen lassen.`;
  return `https://wa.me/4915233540284?text=${encodeURIComponent(text)}`;
}

export function cityJsonLd(city: City) {
  const url = absUrl(cityPath(city));
  const businessId = `${url}#betrieb`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["AutoRepair", "AutomotiveBusiness"],
        "@id": businessId,
        name: `${site.legalName} Fahrzeugaufbereitung ${city.name}`,
        image: absUrl("/media/hero-1080.webp"),
        telephone: "+4915233540284",
        url,
        priceRange: "€€€",
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
        openingHoursSpecification: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [...openingHours.dayOfWeek],
          opens: openingHours.opens,
          closes: openingHours.closes,
        },
        areaServed: {
          "@type": "AdministrativeArea",
          name: city.name,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Startseite", item: site.origin },
          {
            "@type": "ListItem",
            position: 2,
            name: "Hol- & Bringservice",
            item: absUrl("/abholservice"),
          },
          { "@type": "ListItem", position: 3, name: city.name, item: url },
        ],
      },
    ],
  };
}
