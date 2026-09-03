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
      title: `Fahrzeugaufbereitung ${loaderData?.name ?? ""} | ${site.name}`,
      description: `Fahrzeugaufbereitung in ${loaderData?.name ?? ""}: Innenraum, Lack und Keramik. Abholung an Ihrer Adresse, Arbeit in Horb am Neckar. ${loaderData?.blurb ?? ""}`.slice(0, 160),
      path: `/abholservice/${loaderData?.slug ?? ""}`,
      preloadHero: true,
    }),
});

function CityPage() {
  const city = Route.useLoaderData();
  return <CityLanding city={city} />;
}
