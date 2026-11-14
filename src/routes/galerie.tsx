import { createFileRoute, Link } from "@tanstack/react-router";
import { CustomerPhotoGallery } from "@/components/customer-photo-gallery";
import { CustomerProjectStory } from "@/components/customer-project-story";
import { Shot } from "@/components/media";
import { ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { serializeJsonLd } from "@/lib/json-ld";
import { pageHead } from "@/lib/seo";
import { CustomerVideoGallery } from "@/components/customer-video-gallery";
import { customerVideos } from "@/components/results-teaser";
import { WebsiteStudioContent } from "@/components/website-studio-content";
import { loadPublicStudioDocument } from "@/lib/studio-public.functions";
import { studioGalleryPhotos, studioHero, studioMetadata } from "@/lib/studio-public";

export const Route = createFileRoute("/galerie")({
  component: GaleriePage,
  loader: () => loadPublicStudioDocument("gallery"),
  head: ({ loaderData }) => {
    const hero = studioHero(loaderData);
    return pageHead({
      ...studioMetadata(loaderData, {
        title: `Fahrzeugaufbereitung in Horb: Ergebnisse | ${site.name}`,
        description:
          "Echte Fotos und Videos aus der Werkstatt in Horb am Neckar: Fahrzeugwäsche, Innenraumreinigung, Lackfinish und Versiegelung an freigegebenen Kundenfahrzeugen.",
      }),
      path: "/galerie",
      image: hero?.src ?? "/media/atelier-1200.webp",
      ...(hero ? { preloadImage: hero.src } : { preloadShot: "atelier" }),
    });
  },
});

function GaleriePage() {
  const document = Route.useLoaderData();
  const hero = studioHero(document);
  const photos = studioGalleryPhotos(document);
  return (
    <main id="main-content" tabIndex={-1} data-gallery="curated">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Startseite", item: site.origin },
              { "@type": "ListItem", position: 2, name: "Ergebnisse", item: `${site.origin}/galerie` },
            ],
          }),
        }}
      />
      <section className="gallery-intro mx-auto max-w-7xl px-4 sm:px-6">
        <nav aria-label="Brotkrumen" className="gallery-crumbs"><Link to="/">Startseite</Link><span aria-hidden>/</span><span aria-current="page">Ergebnisse</span></nav>
        <div className="gallery-intro-heading">
          <div><p className="kicker">White Gloss · Kundenauftrag</p><h1 className="heading-page">{document?.content.title.trim() || "Echte Ergebnisse aus unserer Werkstatt."}</h1></div>
          <div><p>{document?.content.lead.trim() || "Lack, Leder, Felgen. Entdecken Sie unsere Arbeit an einem echten Kundenfahrzeug – in Bildern und kurzen Filmen."}</p><Link to="/" hash="buchung" className={ctaPrimary}>Termin anfragen</Link></div>
        </div>
        <figure className="gallery-cover">
          {hero ? <img src={hero.src} alt={hero.alt} width={hero.width} height={hero.height} loading="eager" fetchPriority="high" decoding="async" className="size-full object-cover" /> : <Shot name="atelier" alt="Aufbereiteter schwarzer BMW im Seitenprofil vor der Werkstatt" priority framed={false} sizes="(min-width: 1280px) 1200px, 95vw" />}
          <figcaption><span>{hero ? hero.caption : "BMW · Außenaufbereitung"}</span><span>White Gloss · Horb am Neckar</span></figcaption>
        </figure>
      </section>
      <CustomerProjectStory />
      <section id="kundenbilder" className="section mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="kundenbilder-heading">
        <p className="kicker">Aus echten Kundenaufträgen</p>
        <h2 id="kundenbilder-heading" className="heading-2 mt-4">Unsere Arbeit in Bildern.</h2>
        <p className="mt-5 max-w-2xl text-muted">
          Ausgewählte Perspektiven auf{" "}
          <Link to="/leistungen/$slug" params={{ slug: "lackkorrektur" }} className="underline underline-offset-4">
            Lackfinish
          </Link>
          ,{" "}
          <Link to="/leistungen/$slug" params={{ slug: "innenraumreinigung" }} className="underline underline-offset-4">
            Innenraum
          </Link>{" "}
          und das fertige Fahrzeug.
        </p>
        {document && <div className="my-8"><WebsiteStudioContent content={document.content} assets={document.assets} headingLevel={1} showIntro={false} showHero={false} showImages={false} /></div>}
        <CustomerPhotoGallery key={document ? `${document.revisionId}:${photos?.map((photo) => photo.id).join(",")}` : "catalog"} photos={photos} />
        <p className="gallery-permission-note">Originalaufnahmen, mit Zustimmung veröffentlicht. Sichtbare Kennzeichen wurden unkenntlich gemacht.</p>
      </section>
      <section id="kundenbeispiele" className="border-t border-line bg-surface">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <p className="kicker">Kundenbeispiele in Bewegung</p>
          <h2 className="heading-2 mt-4 max-w-2xl">Details, die auf Fotos kaum sichtbar werden.</h2>
          <p className="mt-5 max-w-xl leading-relaxed text-muted">
            Wasser auf versiegeltem Glas, geschützter Lack und ein Blick in den Innenraum.
            Vier kurze Filme zeigen das Ergebnis in Bewegung.
          </p>
          <div className="mt-12"><CustomerVideoGallery videos={customerVideos} /></div>
          <p className="gallery-permission-note">Freigegebene Originalvideos. Ohne Ton und ohne sichtbare Kennzeichen.</p>
        </div>
      </section>
    </main>
  );
}

