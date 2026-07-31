import heroCar from "@/assets/hero-car.jpg";

/** Öffentliche Basis-URL des Projekts – für canonical, og:url und Sitemap. */
export const SITE_URL = "https://whitegloss.de";

/** Macht aus einem Pfad eine absolute URL (Crawler brauchen absolute Angaben). */
export const absUrl = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Standard-Vorschaubild für Social-Shares. */
export const OG_IMAGE = absUrl(heroCar);
export const OG_IMAGE_ALT =
  "Schwarzer Chevrolet Impala in der White Gloss Detailing Neon-Szene";
