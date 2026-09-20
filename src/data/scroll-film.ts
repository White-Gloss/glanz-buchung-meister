const base = "/media/scroll-film";
export const scrollFilm = {
  mobileQuery: "(max-width: 767px)",
  desktopVideo: `${base}/classic-desktop-1280.mp4`,
  mobileVideo: `${base}/classic-mobile-540.mp4`,
  desktopPoster: `${base}/poster-desktop-1280.webp`,
  desktopPosters: `${base}/poster-desktop-1280.webp 1280w, ${base}/poster-desktop-1920.webp 1920w`,
  mobilePoster: `${base}/poster-mobile-540.webp`,
  mobilePosters: `${base}/poster-mobile-540.webp 540w, ${base}/poster-mobile-720.webp 720w`,
};

export const scrollFilmPreloads = [
  {
    rel: "preload" as const,
    as: "image",
    type: "image/webp",
    fetchPriority: "high" as const,
    media: scrollFilm.mobileQuery,
    href: scrollFilm.mobilePoster,
    imageSrcSet: scrollFilm.mobilePosters,
    imageSizes: "100vw",
  },
  {
    rel: "preload" as const,
    as: "image",
    type: "image/webp",
    fetchPriority: "high" as const,
    media: "(min-width: 768px)",
    href: scrollFilm.desktopPoster,
    imageSrcSet: scrollFilm.desktopPosters,
    imageSizes: "100vw",
  },
];
