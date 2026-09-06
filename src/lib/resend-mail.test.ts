import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EmailDeliveryError, mailConfigured, sendResendEmail } from "./resend-mail.ts";

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

describe("Resend delivery contract", () => {
  async function mocked(
    response: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
    work: () => Promise<void>,
  ) {
    const fetchBefore = globalThis.fetch;
    const keyBefore = process.env.RESEND_API_KEY;
    const fromBefore = process.env.MAIL_FROM;
    globalThis.fetch = response;
    process.env.RESEND_API_KEY = "re_fixture";
    process.env.MAIL_FROM = "Fixture <sender@example.invalid>";
    try {
      await work();
    } finally {
      globalThis.fetch = fetchBefore;
      if (keyBefore === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = keyBefore;
      if (fromBefore === undefined) delete process.env.MAIL_FROM;
      else process.env.MAIL_FROM = fromBefore;
    }
  }
  const input = {
    to: "recipient@example.invalid",
    subject: "Fixture",
    text: "Isolated test",
    idempotencyKey: "booking:1:event:1:customer:email:fixture",
    from: "Snapshot <snapshot@example.invalid>",
  };

  it("uses stable idempotency keys, immutable sender, timeout and provider message id", async () => {
    await mocked(
      async (url, init) => {
        assert.equal(url, "https://api.resend.com/emails");
        assert.equal(new Headers(init?.headers).get("Idempotency-Key"), input.idempotencyKey);
        assert.equal(JSON.parse(String(init?.body)).from, input.from);
        assert.ok(init?.signal instanceof AbortSignal);
        assert.equal(init?.redirect, "error");
        return Response.json({ id: "email-fixture" });
      },
      async () => {
        assert.deepEqual(await sendResendEmail(input), { id: "email-fixture" });
      },
    );
  });

  it("classifies transient and permanent HTTP errors without leaking response bodies", async () => {
    for (const [status, name, retryable] of [
      [429, "rate_limit_exceeded", true],
      [503, "internal_server_error", true],
      [400, "validation_error", false],
      [409, "concurrent_idempotent_requests", true],
      [409, "invalid_idempotent_request", false],
    ] as const) {
      await mocked(
        async () => Response.json({ name, message: "private provider detail" }, { status }),
        async () => {
          await assert.rejects(sendResendEmail(input), (error: unknown) => {
            assert.ok(error instanceof EmailDeliveryError);
            assert.equal(error.code, `email_http_${status}`);
            assert.equal(error.retryable, retryable);
            assert.doesNotMatch(error.message, /private/);
            return true;
          });
        },
      );
    }
  });

  it("marks a lost response or missing provider id as ambiguous but safely retryable with the same key", async () => {
    for (const response of [
      async () => {
        throw new Error("private transport detail");
      },
      async () => Response.json({ unexpected: true }),
    ]) {
      await mocked(response, async () => {
        await assert.rejects(sendResendEmail(input), (error: unknown) => {
          assert.ok(error instanceof EmailDeliveryError);
          assert.equal(error.ambiguous, true);
          assert.equal(error.retryable, true);
          assert.doesNotMatch(error.message, /private/);
          return true;
        });
      });
    }
  });

  it("never contacts a provider without configuration", async () => {
    await mocked(
      async () => {
        throw new Error("unexpected fetch");
      },
      async () => {
        delete process.env.RESEND_API_KEY;
        await assert.rejects(
          sendResendEmail(input),
          (error: unknown) =>
            error instanceof EmailDeliveryError && error.code === "email_not_configured",
        );
      },
    );
  });
});
