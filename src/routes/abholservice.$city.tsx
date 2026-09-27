import { createFileRoute, notFound } from "@tanstack/react-router";
import { CityLanding } from "@/components/city-landing";
import { cities } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { citySeoCopy } from "@/lib/city-copy";
import { parseBookingSelection } from "@/lib/booking-selection";

export const Route = createFileRoute("/abholservice/$city")({
  component: CityPage,
  validateSearch: (search: Record<string, unknown>): { leistung?: string } => {
    const { leistung } = parseBookingSelection(search);
    return leistung ? { leistung } : {};
  },
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
  const { leistung } = Route.useSearch();
  return <CityLanding city={city} serviceSlug={leistung} />;
}
