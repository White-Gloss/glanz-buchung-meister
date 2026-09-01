/* Fotos tauschen: Dateien in /public/media/ ersetzen, Dateinamen behalten.
   hero.jpg / hero.webp / hero-*.avif = Startbild
   lack, keramik, felgen, leder, finish, dellen, atelier, private = Slots
   CSS-Klassen: .hero-image, .service-image-1 bis -4, .before-after-1,
   .workshop-image, .gallery-shot, .private-client-image, .b2b-image
*/

export const heroAvifSrcSet =
  "/media/hero-720.avif 720w, /media/hero-1080.avif 1080w, /media/hero-1600.avif 1600w";
export const heroWebpSrcSet =
  "/media/hero-720.webp 720w, /media/hero-1080.webp 1080w, /media/hero-1600.webp 1600w";
export const heroPreloadMobile = "/media/hero-720.avif";
export const heroPreloadHref = "/media/hero-1080.avif";
export const heroPreloadWide = "/media/hero-1600.avif";

export const logoAvifSrcSet =
  "/media/logo-176.avif 176w, /media/logo-280.avif 280w, /media/logo-352.avif 352w, /media/logo-440.avif 440w";
export const logoWebpSrcSet =
  "/media/logo-176.webp 176w, /media/logo-280.webp 280w, /media/logo-352.webp 352w, /media/logo-440.webp 440w";
export const logoJsonLdHref = "/media/logo-760.webp";
