import heroCarAvif from "@/assets/hero-car.avif";
import heroCarMobileAvif from "@/assets/hero-car-mobile.avif";

export const heroImageSources = {
  mobile: {
    src: heroCarMobileAvif,
    width: 960,
    height: 544,
    media: "(max-width: 767px)",
  },
  desktop: {
    src: heroCarAvif,
    width: 1920,
    height: 1088,
  },
} as const;
