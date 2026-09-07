import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWhatsAppProvider,
  normalizeWhatsAppNumber,
  validateWhatsAppConfiguration,
  WhatsAppDeliveryError,
} from "./whatsapp-provider.ts";

const env = {
  WHATSAPP_PROVIDER: "meta",
  WHATSAPP_ACCESS_TOKEN: "test-only-access-token",
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "987654321",
  WHATSAPP_APP_SECRET: "test-only-app-secret",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "test-only-verify-token",
  WHATSAPP_API_VERSION: "v25.0",
  WHATSAPP_TEMPLATE_NAME: "owner_booking_event",
  WHATSAPP_TEMPLATE_LANGUAGE: "de",
  ADMIN_WHATSAPP_NUMBER: "+491234567890",
};
const notification = {
  to: env.ADMIN_WHATSAPP_NUMBER,
  subject: "Neue Anfrage",
  text: "WG-42\nWartet auf Bestätigung",
  idempotencyKey: "booking:42:created:owner",
};
const fakeFetch = (handler: (url: string, init: RequestInit) => Promise<Response>) =>
  ((input, init) => handler(String(input), init!)) as typeof fetch;

describe("Meta WhatsApp provider configuration", () => {
  it("is disabled without explicit env configuration and never falls back to the public shop number", () => {
    assert.deepEqual(validateWhatsAppConfiguration({}), {
      enabled: false,
      configured: false,
      issues: [],
    });
    assert.equal(validateWhatsAppConfiguration({ WHATSAPP_PROVIDER: "meta" }).configured, false);
    assert.equal(validateWhatsAppConfiguration(env).configured, true);
    assert.equal(
      validateWhatsAppConfiguration({
        ...env,
        ADMIN_WHATSAPP_NUMBER: "",
        OWNER_WHATSAPP: env.ADMIN_WHATSAPP_NUMBER,
      }).configured,
      true,
    );
    assert.equal(
      validateWhatsAppConfiguration({
        ...env,
        ADMIN_WHATSAPP_NUMBER: "  ",
        OWNER_WHATSAPP: env.ADMIN_WHATSAPP_NUMBER,
      }).configured,
      true,
    );
    for (const key of Object.keys(env)) {
      const result = validateWhatsAppConfiguration({ ...env, [key]: "" });
      assert.equal(result.configured, false, key);
      assert.ok(!JSON.stringify(result).includes("test-only-access-token"));
    }
    assert.equal(
      validateWhatsAppConfiguration({ ...env, WHATSAPP_API_VERSION: "v25.0/evil" }).configured,
      false,
    );
  });

  it("normalizes only valid international owner numbers", () => {
    assert.equal(normalizeWhatsAppNumber("+49 (123) 456-7890"), "491234567890");
    for (const value of ["", "0123456789", "+49abc1234567", "123", undefined])
      assert.equal(normalizeWhatsAppNumber(value), null);
  });
});

describe("Meta WhatsApp template transport", () => {
  it("sends the configured template with two body parameters and a correlation key", async () => {
    let calls = 0;
    const provider = createWhatsAppProvider(
      env,
      fakeFetch(async (url, init) => {
        calls++;
        assert.equal(url, "https://graph.facebook.com/v25.0/123456789/messages");
        assert.equal(init.method, "POST");
        assert.equal(init.redirect, "error");
        assert.equal(
          new Headers(init.headers).get("authorization"),
          "Bearer test-only-access-token",
        );
        assert.equal(new Headers(init.headers).has("idempotency-key"), false);
        assert.deepEqual(JSON.parse(String(init.body)), {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "491234567890",
          type: "template",
          biz_opaque_callback_data: notification.idempotencyKey,
          template: {
            name: env.WHATSAPP_TEMPLATE_NAME,
            language: { code: "de" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: "Neue Anfrage" },
                  { type: "text", text: "WG-42 Wartet auf Bestätigung" },
                ],
              },
            ],
          },
        });
        return Response.json({ messages: [{ id: "wamid.test-message" }] });
      }),
    );
    assert.deepEqual(await provider.sendNotification(notification), { id: "wamid.test-message" });
    assert.equal(calls, 1);
  });

  it("never calls the API for missing configuration, a different recipient, or invalid summaries", async () => {
    let calls = 0;
    const transport = fakeFetch(async () => {
      calls++;
      return Response.json({});
    });
    await assert.rejects(createWhatsAppProvider({}, transport).sendNotification(notification), {
      code: "provider_disabled",
      retryable: false,
    });
    const provider = createWhatsAppProvider(env, transport);
    for (const input of [
      { ...notification, to: "+491234567899" },
      { ...notification, subject: "" },
      { ...notification, text: "x".repeat(701) },
      { ...notification, idempotencyKey: "private/customer?name=test" },
    ])
      await assert.rejects(provider.sendNotification(input), WhatsAppDeliveryError);
    assert.equal(calls, 0);
  });

  it("classifies explicit rejections without exposing provider details or retrying inline", async () => {
    for (const [status, error, retryable] of [
      [429, { code: 130429 }, true],
      [400, { code: 131056 }, true],
      [503, { code: 131000 }, true],
      [400, { code: 100, is_transient: true }, true],
      [401, { code: 190 }, false],
      [400, { code: 132001 }, false],
    ] as const) {
      let calls = 0;
      const provider = createWhatsAppProvider(
        env,
        fakeFetch(async () => {
          calls++;
          return Response.json(
            { error: { ...error, message: "private customer and secret-token" } },
            { status, headers: { "retry-after": "30" } },
          );
        }),
      );
      await assert.rejects(provider.sendNotification(notification), (failure) => {
        assert.ok(failure instanceof WhatsAppDeliveryError);
        assert.equal(failure.retryable, retryable);
        assert.equal(failure.ambiguous, false);
        assert.equal(failure.retryAfterMs, 30000);
        assert.ok(!failure.message.includes("private"));
        return true;
      });
      assert.equal(calls, 1);
    }
  });

  it("marks lost or unparseable acknowledgements ambiguous, never safely retryable", async () => {
    for (const result of [
      async () => {
        throw new Error("connection reset with secret detail");
      },
      async () => new Response("bad gateway", { status: 502 }),
      async () => Response.json({ messages: [] }),
    ]) {
      const provider = createWhatsAppProvider(env, fakeFetch(result));
      await assert.rejects(provider.sendNotification(notification), (error) => {
        assert.ok(error instanceof WhatsAppDeliveryError);
        assert.equal(error.ambiguous, true);
        assert.equal(error.retryable, false);
        assert.ok(!error.message.includes("secret"));
        return true;
      });
    }
  });

  it("aborts a stalled send at the configured deadline without a second send", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let calls = 0;
    const provider = createWhatsAppProvider(
      { ...env, WHATSAPP_TIMEOUT_MS: "1000" },
      fakeFetch(async (_url, init) => {
        calls++;
        return new Promise<Response>((_resolve, reject) =>
          init.signal!.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          }),
        );
      }),
    );
    const pending = provider.sendNotification(notification);
    const rejected = assert.rejects(pending, {
      code: "send_timeout",
      ambiguous: true,
      retryable: false,
    });
    t.mock.timers.tick(1000);
    await rejected;
    assert.equal(calls, 1);
  });
});
