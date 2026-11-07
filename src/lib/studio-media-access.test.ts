import assert from "node:assert/strict";
import test from "node:test";
import { assertStudioMediaEnabled, studioMediaEnabled } from "./studio-media.server.ts";
import { isIsolatedGithubCi } from "../../scripts/hosting-policy.mjs";

test("media access follows the same explicit rollout gate as Website Studio", () => {
  const previous = process.env.WEBSITE_STUDIO_ENABLED;
  try {
    // The existing strict Linux CI exception is intentional; no fake CI environment is used.
    for (const disabled of [undefined, "false", "1", "TRUE"]) {
      if (disabled === undefined) delete process.env.WEBSITE_STUDIO_ENABLED;
      else process.env.WEBSITE_STUDIO_ENABLED = disabled;
      assert.equal(studioMediaEnabled(), isIsolatedGithubCi());
      if (!isIsolatedGithubCi())
        assert.throws(() => assertStudioMediaEnabled(), /nicht freigeschaltet/);
    }
    process.env.WEBSITE_STUDIO_ENABLED = "true";
    assert.equal(studioMediaEnabled(), true);
    assert.doesNotThrow(() => assertStudioMediaEnabled());
  } finally {
    if (previous === undefined) delete process.env.WEBSITE_STUDIO_ENABLED;
    else process.env.WEBSITE_STUDIO_ENABLED = previous;
  }
});
