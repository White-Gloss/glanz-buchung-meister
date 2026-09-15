import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGoogleReviewsReader,
  matchesGoogleProfile,
  parseGoogleReviews,
} from "./google-reviews.server.ts";
import { googleProfile } from "../data/google-profile.ts";

// Fictional transport fixtures, never displayed in the website.
const profile = {
  title: googleProfile.name,
  websiteUri: "https://white-gloss.de/",
  phoneNumbers: { primaryPhone: "01523 3540284" },
  metadata: { placeId: googleProfile.placeId },
};
const payload = {
  averageRating: 4.2,
  totalReviewCount: 25,
  reviews: [
    {
      reviewId: "fixture-only",
      reviewer: { displayName: "Test person" },
      starRating: "THREE",
      createTime: "2026-09-01T12:00:00Z",
      comment: "Original\ntext … 👍",
    },
  ],
};
const settings = {
  enabled: "true",
  clientId: "fixture",
  clientSecret: "fixture",
  refreshToken: "fixture",
  location: "accounts/123/locations/456",
};
test("profile identity must match place, name, website and phone", () => {
  assert.equal(matchesGoogleProfile(profile), true);
  assert.equal(matchesGoogleProfile({ ...profile, metadata: { placeId: "other" } }), false);
  assert.equal(matchesGoogleProfile({ ...profile, websiteUri: "https://example.invalid" }), false);
  assert.equal(matchesGoogleProfile({ ...profile, phoneNumbers: { primaryPhone: "1234" } }), false);
});
test("uses Google's aggregate without recomputing it from the displayed sample; preserves text", () => {
  const parsed = parseGoogleReviews(payload);
  assert.equal(parsed.averageRating, 4.2);
  assert.equal(parsed.totalReviewCount, 25);
  assert.equal(parsed.reviews[0].rating, 3);
  assert.equal(parsed.reviews[0].text, payload.reviews[0].comment);
  assert.throws(() => parseGoogleReviews({ ...payload, averageRating: 6 }));
});
test("disabled or incomplete configuration never calls Google", async () => {
  const fetcher: typeof fetch = async () => {
    throw new Error("must not call");
  };
  assert.equal(await createGoogleReviewsReader(() => ({}), fetcher)(), null);
  assert.equal(await createGoogleReviewsReader(() => ({ enabled: "true" }), fetcher)(), null);
});
test("coalesces concurrent reads, expires content, backs off and recovers after failures", async () => {
  let now = 1000,
    calls = 0,
    fail = false;
  const fetcher: typeof fetch = async (url) => {
    calls++;
    if (fail) return new Response("private error body", { status: 503 });
    const value = String(url).includes("oauth2")
      ? { access_token: "fixture-token" }
      : String(url).includes("businessinformation")
        ? profile
        : payload;
    return Response.json(value);
  };
  const read = createGoogleReviewsReader(
    () => settings,
    fetcher,
    () => now,
  );
  const [a, b] = await Promise.all([read(), read()]);
  assert.deepEqual(a, b);
  assert.equal(calls, 3);
  await read();
  assert.equal(calls, 3);
  now += 3600001;
  fail = true;
  assert.equal(await read(), null);
  assert.equal(calls, 4);
  assert.equal(await read(), null);
  assert.equal(calls, 4);
  now += 300001;
  fail = false;
  assert.equal((await read())?.totalReviewCount, 25);
  assert.equal(calls, 7);
});
test("a mismatched business cannot publish reviews", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () =>
    Response.json(
      ++calls === 1
        ? { access_token: "fixture-token" }
        : { ...profile, title: "Different business" },
    );
  assert.equal(await createGoogleReviewsReader(() => settings, fetcher)(), null);
  assert.equal(calls, 2);
});
