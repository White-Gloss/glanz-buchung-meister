/**
 * Decorative stills from the two owner-approved eight-second clips.
 * Exterior/paint: older exterior clip at 7.2s/1.0s; interior: newer clip at 5.5s.
 * These are atmosphere images, not evidence of customer work.
 */
export const conciergeAtmosphere = ["exterior", "interior", "paint"].map((id) => ({
  id,
  src: `/media/atmosphere/${id}-960.webp`,
  srcSet: [640, 960, 1440]
    .map((width) => `/media/atmosphere/${id}-${width}.webp ${width}w`)
    .join(", "),
  width: 1440,
  height: 810,
  backdrop: `/media/atmosphere/${id}-backdrop.webp`,
}));
