import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mailConfigured } from "./resend-mail.ts";

describe("mailConfigured", () => {
  it("is true only when RESEND_API_KEY and MAIL_FROM are set", () => {
    const prevKey = process.env.RESEND_API_KEY;
    const prevFrom = process.env.MAIL_FROM;
    try {
      delete process.env.RESEND_API_KEY;
      delete process.env.MAIL_FROM;
      assert.equal(mailConfigured(), false);

      process.env.RESEND_API_KEY = "re_test";
      delete process.env.MAIL_FROM;
      assert.equal(mailConfigured(), false);

      delete process.env.RESEND_API_KEY;
      process.env.MAIL_FROM = "White Gloss <buchung@whitegloss.de>";
      assert.equal(mailConfigured(), false);

      process.env.RESEND_API_KEY = "re_test";
      process.env.MAIL_FROM = "White Gloss <buchung@whitegloss.de>";
      assert.equal(mailConfigured(), true);

      process.env.RESEND_API_KEY = "  ";
      process.env.MAIL_FROM = "White Gloss <buchung@whitegloss.de>";
      assert.equal(mailConfigured(), false);
    } finally {
      if (prevKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = prevKey;
      if (prevFrom === undefined) delete process.env.MAIL_FROM;
      else process.env.MAIL_FROM = prevFrom;
    }
  });
});
