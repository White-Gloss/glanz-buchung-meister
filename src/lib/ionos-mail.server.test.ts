import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { Sql } from "./db.ts";
import { sendIonosEmail } from "./ionos-mail.server.ts";
import { EmailDeliveryError } from "./resend-mail.ts";

const sql = {} as Sql;
const input = {
  to: "kunde@example.invalid",
  subject: "Terminbestätigung",
  text: "Hallo",
  idempotencyKey: "booking:1:event:1:customer:email:fixture",
};

test("IONOS rejects invalid messages without SMTP side effects", async () => {
  for (const patch of [
    { to: "invalid" },
    { subject: "Betreff\nInjected" },
    { idempotencyKey: "" },
  ]) {
    let touched = false;
    await assert.rejects(
      sendIonosEmail(
        sql,
        { ...input, ...patch },
        {
          readConfig: async () => ({ enabled: true, password: "secret" }),
          createTransport: async () => {
            touched = true;
            throw new Error("should not be called");
          },
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof EmailDeliveryError);
        assert.equal(error.code, "ionos_invalid_message");
        assert.equal(error.retryable, false);
        return true;
      },
    );
    assert.equal(touched, false);
  }
});

test("IONOS requires enabled configuration", async () => {
  await assert.rejects(
    sendIonosEmail(sql, input, {
      readConfig: async () => ({ enabled: false, password: "" }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.code, "ionos_not_configured");
      assert.equal(error.retryable, false);
      return true;
    },
  );
});

test("IONOS accepts only explicit recipient acknowledgements", async () => {
  const expectedId = `<wg-${createHash("sha256").update(input.idempotencyKey).digest("hex")}@white-gloss.de>`;
  let closed = 0;
  const ok = await sendIonosEmail(
    sql,
    input,
    {
      readConfig: async () => ({ enabled: true, password: "secret" }),
      createTransport: async () => ({
        verify: async () => true,
        sendMail: async () => ({ accepted: ["KUNDE@example.invalid"] }),
        close: () => {
          closed++;
        },
      }),
    },
  );
  assert.deepEqual(ok, { id: expectedId });
  assert.equal(closed, 1);

  closed = 0;
  await assert.rejects(
    sendIonosEmail(
      sql,
      input,
      {
        readConfig: async () => ({ enabled: true, password: "secret" }),
        createTransport: async () => ({
          verify: async () => true,
          sendMail: async () => ({ accepted: ["other@example.invalid"] }),
          close: () => {
            closed++;
          },
        }),
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.code, "ionos_response_unknown");
      assert.equal(error.retryable, false);
      assert.equal(error.ambiguous, true);
      return true;
    },
  );
  assert.equal(closed, 1);
});

test("IONOS classifies auth and ambiguous transport failures", async () => {
  await assert.rejects(
    sendIonosEmail(
      sql,
      input,
      {
        readConfig: async () => ({ enabled: true, password: "secret" }),
        createTransport: async () => ({
          verify: async () => true,
          sendMail: async () => {
            throw Object.assign(new Error("auth"), { code: "EAUTH" });
          },
          close: () => {},
        }),
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.code, "ionos_auth_failed");
      assert.equal(error.retryable, false);
      assert.equal(error.ambiguous, false);
      return true;
    },
  );

  await assert.rejects(
    sendIonosEmail(
      sql,
      input,
      {
        readConfig: async () => ({ enabled: true, password: "secret" }),
        createTransport: async () => ({
          verify: async () => true,
          sendMail: async () => {
            throw new Error("connection reset");
          },
          close: () => {},
        }),
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.code, "ionos_transport_unknown");
      assert.equal(error.retryable, false);
      assert.equal(error.ambiguous, true);
      return true;
    },
  );
});
