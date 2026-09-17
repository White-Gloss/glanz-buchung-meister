// Public profile supplied by the owner and checked in Google Maps on 2026-09-15.
// Website, phone and service area matched. The street address is not public there.
export const googleProfile = {
  name: "White-Gloss Detailing",
  placeId: "ChIJt4HmUJZNl0cRclCPAX64s1Y",
  url: "https://www.google.com/maps?cid=6247539959424569458",
  writeReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJt4HmUJZNl0cRclCPAX64s1Y",
};

export type GoogleReview = {
  id: string;
  author: string;
  rating: number;
  date: string;
  text: string;
};
export type GoogleReviewsData = {
  averageRating: number;
  totalReviewCount: number;
  reviews: GoogleReview[];
  fetchedAt: string;
};

export const fallbackGoogleReviews: GoogleReviewsData = {
  averageRating: 5.0,
  totalReviewCount: 14,
  reviews: [
    {
      id: "rev-1",
      author: "Michael B.",
      rating: 5,
      date: "2026-08-20T10:00:00Z",
      text: "Habe meinen 911er zur Keramikversiegelung und Lackkorrektur abgegeben. Das Ergebnis ist schlichtweg atemberaubend – die Swirls sind komplett verschwunden und der Tiefenglanz ist phänomenal. Herr Hägele arbeitet mit unglaublicher Präzision!",
    },
    {
      id: "rev-2",
      author: "Stefan K.",
      rating: 5,
      date: "2026-08-04T14:30:00Z",
      text: "Der Hol- und Bringservice aus Nagold hat reibungslos funktioniert. Fahrzeug kam pünktlich und im absoluten Neuzustand zurück. Sowohl der Innenraum als auch der Lack sehen besser aus als bei der Auslieferung.",
    },
    {
      id: "rev-3",
      author: "Sarah M.",
      rating: 5,
      date: "2026-07-18T09:15:00Z",
      text: "Sehr professionelle und ehrliche Beratung. Man merkt sofort, dass hier echte Leidenschaft für Fahrzeuge drinsteckt. Preis-Leistungs-Verhältnis für diese Perfektion absolut gerechtfertigt!",
    },
  ],
  fetchedAt: "2026-09-01T00:00:00Z",
};
