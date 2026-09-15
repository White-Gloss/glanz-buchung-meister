import { z } from "zod";
import { googleProfile, type GoogleReviewsData } from "../data/google-profile.ts";

const stars = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as const;
const reviewSchema = z.object({
  reviewId: z.string().min(1),
  reviewer: z.object({ displayName: z.string().optional(), isAnonymous: z.boolean().optional() }),
  starRating: z.enum(["ONE", "TWO", "THREE", "FOUR", "FIVE"]),
  createTime: z.iso.datetime({ offset: true }),
  updateTime: z.iso.datetime({ offset: true }).optional(),
  comment: z.string().optional(),
});
const responseSchema = z.object({
  averageRating: z.number().min(1).max(5),
  totalReviewCount: z.number().int().positive(),
  reviews: z.array(reviewSchema).default([]),
});

export function parseGoogleReviews(raw: unknown, now = Date.now()): GoogleReviewsData {
  const data = responseSchema.parse(raw);
  if (data.reviews.length > data.totalReviewCount) throw new Error("Invalid review count");
  return {
    averageRating: data.averageRating,
    totalReviewCount: data.totalReviewCount,
    // Preserve the API's updateTime-descending order, including textless reviews.
    reviews: data.reviews.slice(0, 3).map((review) => ({
      id: review.reviewId,
      author: review.reviewer.isAnonymous
        ? "Anonym"
        : review.reviewer.displayName || "Google-Nutzer",
      rating: stars[review.starRating],
      date: review.updateTime || review.createTime,
      text: review.comment ?? "",
    })),
    fetchedAt: new Date(now).toISOString(),
  };
}

export function matchesGoogleProfile(raw: unknown): boolean {
  const profile = z
    .object({
      title: z.string(),
      websiteUri: z.string().url(),
      phoneNumbers: z.object({ primaryPhone: z.string() }),
      metadata: z.object({ placeId: z.string() }),
    })
    .safeParse(raw);
  if (!profile.success) return false;
  const value = profile.data;
  const phone = value.phoneNumbers.primaryPhone
    .replace(/\D/g, "")
    .replace(/^0049/, "49")
    .replace(/^0/, "49");
  return (
    value.metadata.placeId === googleProfile.placeId &&
    new URL(value.websiteUri).hostname.replace(/^www\./, "") === "white-gloss.de" &&
    phone === "4915233540284" &&
    value.title.toLowerCase().replace(/[^a-z]/g, "") === "whiteglossdetailing"
  );
}

type Settings = {
  enabled?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  location?: string;
};

/** One-hour process-memory cache; no disk/CDN persistence, no expired content.
 * Requires an approved owner GBP project and an explicitly authorized token.
 * Never reuses the sign-in integration or calls the billable Places API. */
export function createGoogleReviewsReader(
  settings: () => Settings,
  fetcher: typeof fetch = fetch,
  now = Date.now,
) {
  let cache: GoogleReviewsData | null = null;
  let expires = 0;
  let inFlight: Promise<GoogleReviewsData | null> | undefined;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  return async (): Promise<GoogleReviewsData | null> => {
    const config = settings();
    if (
      config.enabled !== "true" ||
      !config.clientId ||
      !config.clientSecret ||
      !config.refreshToken ||
      !/^accounts\/\d+\/locations\/\d+$/.test(config.location || "")
    ) {
      cache = null;
      expires = 0;
      return null;
    }
    if (now() < expires) return cache;
    if (inFlight) return inFlight;
    cache = null;
    inFlight = (async () => {
      try {
        const tokenResponse = await fetcher("https://oauth2.googleapis.com/token", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          body: new URLSearchParams({
            client_id: config.clientId!,
            client_secret: config.clientSecret!,
            refresh_token: config.refreshToken!,
            grant_type: "refresh_token",
          }),
        });
        if (!tokenResponse.ok) throw new Error("Google authorization unavailable");
        const { access_token } = z
          .object({ access_token: z.string().min(1) })
          .parse(await tokenResponse.json());
        const headers = { Authorization: `Bearer ${access_token}` };
        const location = config.location!.split("/").slice(-2).join("/");
        const profileResponse = await fetcher(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${location}?readMask=title,websiteUri,phoneNumbers,metadata`,
          { headers, signal: AbortSignal.timeout(5000) },
        );
        if (!profileResponse.ok || !matchesGoogleProfile(await profileResponse.json()))
          throw new Error("Google profile mismatch");
        const reviewsResponse = await fetcher(
          `https://mybusiness.googleapis.com/v4/${config.location}/reviews?pageSize=3&orderBy=updateTime%20desc`,
          { headers, signal: AbortSignal.timeout(5000) },
        );
        if (!reviewsResponse.ok) throw new Error("Google reviews unavailable");
        cache = parseGoogleReviews(await reviewsResponse.json(), now());
        expires = now() + 60 * 60 * 1000;
        clearTimeout(expiryTimer);
        expiryTimer = setTimeout(
          () => {
            cache = null;
            expires = 0;
          },
          60 * 60 * 1000,
        );
        expiryTimer.unref?.();
        return cache;
      } catch {
        // Failure backoff, no token/provider-body logging or invented fallback rating.
        cache = null;
        expires = now() + 5 * 60 * 1000;
        return null;
      } finally {
        inFlight = undefined;
      }
    })();
    return inFlight;
  };
}

export const readGoogleReviews = createGoogleReviewsReader(() => ({
  enabled: process.env.GBP_REVIEWS_ENABLED,
  clientId: process.env.GBP_CLIENT_ID,
  clientSecret: process.env.GBP_CLIENT_SECRET,
  refreshToken: process.env.GBP_REFRESH_TOKEN,
  location: process.env.GBP_LOCATION,
}));
