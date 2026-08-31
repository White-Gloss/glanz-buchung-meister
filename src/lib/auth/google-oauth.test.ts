import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { googleNativeLoginEnabled, googleOAuthCredentials } from "./google-oauth.ts";

describe("native Google OAuth credentials", () => {
  it("is off when env and embed are empty", () => {
    const prevId = process.env.GOOGLE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CLIENT_SECRET;
    const prevVite = process.env.VITE_GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.VITE_GOOGLE_CLIENT_ID;
    try {
      assert.equal(googleOAuthCredentials(), null);
      assert.equal(googleNativeLoginEnabled(), false);
    } finally {
      if (prevId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = prevId;
      if (prevSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = prevSecret;
      if (prevVite === undefined) delete process.env.VITE_GOOGLE_CLIENT_ID;
      else process.env.VITE_GOOGLE_CLIENT_ID = prevVite;
    }
  });

  it("reads client id and secret from env", () => {
    const prevId = process.env.GOOGLE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CLIENT_ID = "id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "secret-value";
    try {
      assert.deepEqual(googleOAuthCredentials(), {
        clientId: "id.apps.googleusercontent.com",
        clientSecret: "secret-value",
      });
      assert.equal(googleNativeLoginEnabled(), true);
    } finally {
      if (prevId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = prevId;
      if (prevSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = prevSecret;
    }
  });
});
