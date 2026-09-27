import { createFileRoute, notFound } from "@tanstack/react-router";
import { CityLanding } from "@/components/city-landing";
import { cities } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { citySeoCopy } from "@/lib/city-copy";

export const Route = createFileRoute("/abholservice/$city")({
  component: CityPage,
  loader: ({ params }) => {
    const city = cities.find((c) => c.slug === params.city.toLowerCase());
    if (!city) throw notFound();
    return city;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const copy = citySeoCopy(loaderData);
    return pageHead({
      title: copy.title,
      description: copy.description,
      path: `/abholservice/${loaderData.slug}`,
      preloadHero: true,
    });
  },
});

function CityPage() {
  const city = Route.useLoaderData();
  return <CityLanding city={city} />;
}
