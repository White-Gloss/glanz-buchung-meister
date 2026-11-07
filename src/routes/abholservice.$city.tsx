import { createFileRoute, notFound } from "@tanstack/react-router";
import { CityLanding } from "@/components/city-landing";
import { cities } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { citySeoCopy } from "@/lib/city-copy";
import { parseBookingSelection } from "@/lib/booking-selection";
import { loadPublicStudioDocument } from "@/lib/studio-public.functions";
import { studioHero, studioMetadata } from "@/lib/studio-public";

export const Route = createFileRoute("/abholservice/$city")({
  component: CityPage,
  validateSearch: (search: Record<string, unknown>): { leistung?: string } => {
    const { leistung } = parseBookingSelection(search);
    return leistung ? { leistung } : {};
  },
  loader: async ({ params }) => {
    const city = cities.find((c) => c.slug === params.city.toLowerCase());
    if (!city) throw notFound();
    return { city, document: await loadPublicStudioDocument(`city:${city.slug}`) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const copy = citySeoCopy(loaderData.city);
    const hero = studioHero(loaderData.document);
    return pageHead({
      ...studioMetadata(loaderData.document, copy),
      path: `/abholservice/${loaderData.city.slug}`,
      ...(hero ? { preloadImage: hero.src, image: hero.src } : { preloadHero: true }),
    });
  },
});

function CityPage() {
  const { city, document } = Route.useLoaderData();
  const { leistung } = Route.useSearch();
  return <CityLanding city={city} serviceSlug={leistung} editorial={document} />;
}

