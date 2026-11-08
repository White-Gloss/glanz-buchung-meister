import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { WebsiteStudioContent } from "@/components/website-studio-content";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { serializeJsonLd } from "@/lib/json-ld";
import { pageHead } from "@/lib/seo";
import { loadPublicStudioDocument } from "@/lib/studio-public.functions";
import { studioHero, studioMetadata } from "@/lib/studio-public";

export const Route = createFileRoute("/ueber-uns")({
  loader: async () => {
    const document = await loadPublicStudioDocument("about");
    if (!document) throw notFound();
    return document;
  },
  head: ({ loaderData }) => {
    const hero = studioHero(loaderData);
    return pageHead({
      ...studioMetadata(loaderData, {
        title: `${loaderData?.content.title || "Über uns"} | ${site.name}`,
        description:
          loaderData?.content.lead || `${site.owner} · Fahrzeugaufbereitung in ${site.city}.`,
      }),
      path: "/ueber-uns",
      ...(!loaderData ? { robots: "noindex,nofollow" } : {}),
      ...(hero ? { preloadImage: hero.src, image: hero.src } : { preloadShot: "atelier" as const }),
    });
  },
  component: AboutPage,
});

function AboutPage() {
  const document = Route.useLoaderData();
  const hero = studioHero(document);
  return (
    <main id="main-content" tabIndex={-1}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "@id": `${site.origin}/ueber-uns#webpage`,
            url: `${site.origin}/ueber-uns`,
            name: document.content.title,
            about: { "@id": `${site.origin}/#betrieb` },
          }),
        }}
      />
      <PageHero
        title={document.content.title}
        lead={document.content.lead}
        kicker="White-Gloss Detailing"
        shot={hero ? undefined : "atelier"}
        alt={
          hero?.alt ??
          "Aufbereitetes Kundenfahrzeug vor der Werkstatt von White Gloss in Horb am Neckar"
        }
        media={
          hero ? (
            <img
              src={hero.src}
              alt={hero.alt}
              width={hero.width}
              height={hero.height}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="size-full object-cover"
            />
          ) : undefined
        }
        crumbs={[{ label: "Startseite", to: "/" }, { label: "Über uns" }]}
        actions={
          <>
            <Link to="/" hash="buchung" className={ctaPrimary}>
              Termin anfragen
            </Link>
            <Link to="/kontakt" className={ctaGhost}>
              Kontakt aufnehmen
            </Link>
          </>
        }
      />
      <section className="section mx-auto max-w-7xl px-4 sm:px-6" aria-label="Über White-Gloss">
        <WebsiteStudioContent
          content={document.content}
          assets={document.assets}
          headingLevel={1}
          showIntro={false}
          showHero={false}
        />
      </section>
    </main>
  );
}
