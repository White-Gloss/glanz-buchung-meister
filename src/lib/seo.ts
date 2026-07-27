import logoLg from "@/assets/wgd-logo-760.webp.asset.json";

/** Öffentliche Basis-URL des Projekts – für canonical, og:url und Sitemap. */
export const SITE_URL = "https://glanz-buchung-meister.lovable.app";

/** Macht aus einem Pfad eine absolute URL (Crawler brauchen absolute Angaben). */
export const absUrl = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Standard-Vorschaubild für Social-Shares. */
export const OG_IMAGE = absUrl(logoLg.url);
export const OG_IMAGE_ALT =
  "White Gloss Detailing – Logo mit Muscle-Car-Silhouette";
