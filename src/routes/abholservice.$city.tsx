import { createFileRoute, notFound } from "@tanstack/react-router";
import { CityLanding } from "@/components/city-landing";
import { cities, site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/abholservice/$city")({
  component: CityPage,
  loader: ({ params }) => {
    const city = cities.find((c) => c.slug === params.city.toLowerCase());
    if (!city) throw notFound();
    return city;
  },
  head: ({ loaderData }) =>
    pageHead({
      title: `Hol- und Bringservice ${loaderData?.name ?? ""} | ${site.name}`,
      description: `Hol- und Bringservice aus ${loaderData?.name ?? ""}: Wir holen Ihr Fahrzeug zur Aufbereitung in unserer Werkstatt in Horb am Neckar ab. Preise und Ablauf.`,
      path: `/abholservice/${loaderData?.slug ?? ""}`,
      preloadHero: true,
    }),
});

function CityPage() {
  const city = Route.useLoaderData();
  return <CityLanding city={city} />;
}
