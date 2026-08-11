import heroCar from "@/assets/hero-car.jpg";

/** Öffentliche Basis-URL des Projekts – für canonical, og:url und Sitemap. */
export const SITE_URL = "https://white-gloss.de";

/** Macht aus einem Pfad eine absolute URL (Crawler brauchen absolute Angaben). */
export const absUrl = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Standard-Vorschaubild für Social-Shares. */
export const OG_IMAGE = absUrl(heroCar);
export const OG_IMAGE_ALT = "Schwarzer Chevrolet Impala in der White Gloss Detailing Neon-Szene";
export const OG_IMAGE_WIDTH = "1920";
export const OG_IMAGE_HEIGHT = "1088";

type StandardMetaInput = {
  title: string;
  description: string;
  path: string;
  url?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: string;
  imageHeight?: string;
};

/**
 * Einheitliche SEO-/Social-Basis-Metas für öffentliche Seiten.
 * Hält OpenGraph und Twitter-Tags konsistent auf allen Landingpages.
 */
export function standardPageMeta({
  title,
  description,
  path,
  url,
  image = OG_IMAGE,
  imageAlt = OG_IMAGE_ALT,
  imageWidth,
  imageHeight,
}: StandardMetaInput) {
  const resolvedImageWidth = imageWidth ?? (image === OG_IMAGE ? OG_IMAGE_WIDTH : undefined);
  const resolvedImageHeight = imageHeight ?? (image === OG_IMAGE ? OG_IMAGE_HEIGHT : undefined);

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url ?? absUrl(path) },
    { property: "og:image", content: image },
    { property: "og:image:alt", content: imageAlt },
    ...(resolvedImageWidth ? [{ property: "og:image:width", content: resolvedImageWidth }] : []),
    ...(resolvedImageHeight ? [{ property: "og:image:height", content: resolvedImageHeight }] : []),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: imageAlt },
  ];
}
