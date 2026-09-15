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
