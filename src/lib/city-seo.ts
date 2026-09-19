import type { City } from "@/data/site";
import { site } from "@/data/site";
import { absUrl } from "@/lib/seo";

export function cityPath(city: City) {
  return `/abholservice/${city.slug}`;
}

export function whatsappForCity(cityName: string) {
  const text = `Hallo White Gloss, ich interessiere mich für eine Fahrzeugaufbereitung in ${cityName} und würde den Aufwand gern anhand von Fotos einschätzen lassen.`;
  return `https://wa.me/4915233540284?text=${encodeURIComponent(text)}`;
}

export function serviceCityTitle(serviceName: string, city: City) {
  if (city.slug === "horb-am-neckar") {
    return `${serviceName} mit Abholung in Horb | ${site.name}`;
  }
  return `${serviceName} ${city.name} | ${site.name}`;
}

export function serviceCityHeading(serviceName: string, city: City) {
  return city.slug === "horb-am-neckar"
    ? `${serviceName} mit Abholung in ${city.name}`
    : `${serviceName} in ${city.name}`;
}

export function cityJsonLd(city: City) {
  const url = absUrl(cityPath(city));
  const businessId = `${site.origin}/#betrieb`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `Hol- und Bringservice für Fahrzeugaufbereitung in ${city.name}`,
        serviceType: "Fahrzeugabholung und -rückgabe zur Fahrzeugaufbereitung",
        image: absUrl("/media/hero-1080.webp"),
        url,
        provider: {
          "@type": ["AutoRepair", "AutomotiveBusiness"],
          "@id": businessId,
          name: site.legalName,
          url: site.origin,
          telephone: "+4915233540284",
          address: {
            "@type": "PostalAddress",
            streetAddress: site.street,
            postalCode: site.postalCode,
            addressLocality: site.city,
            addressRegion: site.region,
            addressCountry: "DE",
          },
        },
        areaServed: {
          "@type": "City",
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
