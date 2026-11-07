import type { CmsDocumentContent } from "@/lib/cms.model";
import type { StudioAsset } from "@/lib/studio-media.model";

/** Shared, text-only rendering for protected previews and published pages. */
export function WebsiteStudioContent({
  content,
  assets = [],
  preview = false,
  headingLevel = 2,
  showIntro = true,
  showHero = true,
  showImages = true,
  showBody = true,
}: {
  content: CmsDocumentContent;
  assets?: StudioAsset[];
  preview?: boolean;
  headingLevel?: 1 | 2;
  showIntro?: boolean;
  showHero?: boolean;
  showImages?: boolean;
  showBody?: boolean;
}) {
  const Title = headingLevel === 1 ? "h1" : "h2";
  const SectionTitle = headingLevel === 1 ? "h2" : "h3";
  const findAsset = (id: string) => assets.find((asset) => asset.id === id);
  const hero = content.heroAssetId ? findAsset(content.heroAssetId) : undefined;
  const heroAlt =
    content.images.find((item) => item.assetId === content.heroAssetId)?.alt ?? hero?.alt;
  function picture(asset: StudioAsset, alt: string, eager = false) {
    return (
      <img
        src={preview ? asset.previewSrc : asset.src}
        alt={alt}
        width={asset.width}
        height={asset.height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="h-auto w-full rounded-md object-contain"
      />
    );
  }
  return (
    <div className="space-y-8 break-words" data-studio-content>
      {showIntro && (
        <header className="max-w-3xl space-y-4">
          <Title className="font-display text-3xl leading-tight sm:text-5xl">{content.title}</Title>
          {content.lead && (
            <p className="whitespace-pre-line text-lg leading-relaxed text-muted">{content.lead}</p>
          )}
        </header>
      )}
      {showHero && hero && (
        <figure className="max-w-4xl">{picture(hero, heroAlt ?? "", showIntro)}</figure>
      )}
      {showBody && content.body && (
        <p className="max-w-3xl whitespace-pre-line leading-relaxed text-muted">{content.body}</p>
      )}
      {content.sections.map((section) => (
        <section key={section.id} className="max-w-3xl space-y-3">
          <SectionTitle className="font-display text-2xl sm:text-3xl">{section.title}</SectionTitle>
          <p className="whitespace-pre-line leading-relaxed text-muted">{section.body}</p>
        </section>
      ))}
      {showImages && content.images.length > 0 && (
        <div className="grid items-start gap-6 sm:grid-cols-2">
          {content.images
            .filter((item) => item.assetId !== content.heroAssetId)
            .map((item) => {
              const asset = findAsset(item.assetId);
              return asset ? (
                <figure key={item.assetId} className="space-y-2">
                  {picture(asset, item.alt)}
                  {item.caption && (
                    <figcaption className="text-sm leading-relaxed text-muted">
                      {item.caption}
                    </figcaption>
                  )}
                </figure>
              ) : preview ? (
                <p
                  key={item.assetId}
                  role="status"
                  className="rounded-md border border-line p-4 text-sm"
                >
                  Ein ausgewähltes Bild ist nicht mehr verfügbar. Bitte ersetzen Sie es vor der
                  Veröffentlichung.
                </p>
              ) : null;
            })}
        </div>
      )}
      {content.faqs.length > 0 && (
        <section className="max-w-3xl space-y-4" aria-label="Fragen und Antworten">
          {content.faqs.map((faq, index) => (
            <div key={`${index}-${faq.question}`} className="space-y-2">
              <SectionTitle className="text-lg font-medium">{faq.question}</SectionTitle>
              <p className="whitespace-pre-line leading-relaxed text-muted">{faq.answer}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
