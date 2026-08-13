import heroCar from "@/assets/hero-car.jpg";

/** Öffentliche Basis-URL des Projekts – für canonical, og:url und Sitemap. */
export const SITE_URL = "https://white-gloss.de";

/** Macht aus einem Pfad eine absolute URL (Crawler brauchen absolute Angaben). */
export const absUrl = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Standard-Vorschaubild für Social-Shares. */
export const OG_IMAGE = absUrl(heroCar);
export const OG_IMAGE_ALT = "Schwarzer Chevrolet Impala in der White Gloss Detailing Neon-Szene";
export const OG_IMAGE_WIDTH = 1920;
export const OG_IMAGE_HEIGHT = 1088;

type StandardMetaInputBase = {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
};

type StandardMetaInput =
  | (StandardMetaInputBase & { path: string; url?: never })
  | (StandardMetaInputBase & { url: string; path?: never });

/**
 * Einheitliche SEO-/Social-Basis-Metas für öffentliche Seiten.
 * Hält OpenGraph und Twitter-Tags konsistent auf allen Landingpages.
 */
export function standardPageMeta({
  title,
  description,
  path,
  url,
  image,
  imageAlt,
  imageWidth,
  imageHeight,
}: StandardMetaInput) {
  const resolvedImage = image ?? OG_IMAGE;
  const resolvedImageAlt = imageAlt ?? OG_IMAGE_ALT;
  const customImageProvided = image !== undefined;
  const resolvedImageWidth = imageWidth ?? (!customImageProvided ? OG_IMAGE_WIDTH : undefined);
  const resolvedImageHeight = imageHeight ?? (!customImageProvided ? OG_IMAGE_HEIGHT : undefined);
  const resolvedUrl = url ?? absUrl(path);

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: resolvedUrl },
    { property: "og:image", content: resolvedImage },
    { property: "og:image:alt", content: resolvedImageAlt },
    ...(resolvedImageWidth
      ? [{ property: "og:image:width", content: String(resolvedImageWidth) }]
      : []),
    ...(resolvedImageHeight
      ? [{ property: "og:image:height", content: String(resolvedImageHeight) }]
      : []),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: resolvedImage },
    { name: "twitter:image:alt", content: resolvedImageAlt },
  ];
}
