import assert from "node:assert/strict";
import { test } from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { hashPassword } from "better-auth/crypto";
import { emailPasswordOptions } from "./email-password.ts";

const origin = "https://auth-test.example.invalid";
const password = "Synthetic-credential-2026!";
const existingId = "existing-operator-fixture";
const existingEmail = "existing-operator@white-gloss.de";

/** Real Better Auth request handling; no listener, network, production data or mail. */
async function fixture() {
  const now = new Date();
  const database = {
    user: [{
      id: existingId, email: existingEmail, name: "Synthetic operator",
      emailVerified: false, createdAt: now, updatedAt: now,
    }],
    account: [{
      id: "credential-fixture", userId: existingId, accountId: existingId,
      providerId: "credential", password: await hashPassword(password),
      createdAt: now, updatedAt: now,
    }],
    session: [],
    verification: [],
  };
  const auth = betterAuth({
    baseURL: origin,
    secret: "isolated-auth-fixture-secret-never-production",
    database: memoryAdapter(database),
    emailAndPassword: emailPasswordOptions,
    trustedOrigins: [origin],
    telemetry: { enabled: false },
    logger: { disabled: true },
  });
  const post = (path, body) => auth.handler(new Request(origin + "/api/auth" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  }));
  return { database, post };
}

test("public password signup cannot create another operator even with a company email", async () => {
  const { database, post } = await fixture();
  const response = await post("/sign-up/email", {
    name: "Uninvited synthetic user",
    email: "not-an-authorized-mailbox@white-gloss.de",
    password,
  });
  assert.equal(response.status, 400, "Public signup must be rejected by the real auth handler");
  assert.equal((await response.json()).code, "EMAIL_PASSWORD_SIGN_UP_DISABLED");
  assert.equal(response.headers.get("set-cookie"), null, "Rejected signup must not issue a session");
  assert.equal(database.user.length, 1, "No user may be created");
  assert.equal(database.account.length, 1, "No credential may be created");
  assert.equal(database.session.length, 0, "No session may be created");
});

test("existing password accounts keep signing in after public signup is disabled", async () => {
  const { database, post } = await fixture();
  const response = await post("/sign-in/email", { email: existingEmail, password });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.user.id, existingId);
  assert.ok(result.token, "A valid existing credential still creates a session");
  assert.equal(database.user.length, 1);
  assert.equal(database.account.length, 1);
  assert.equal(database.session.length, 1);
});

test("incorrect passwords remain rejected without issuing a session", async () => {
  const { database, post } = await fixture();
  const response = await post("/sign-in/email", {
    email: existingEmail, password: "Incorrect-synthetic-password",
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "INVALID_EMAIL_OR_PASSWORD");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(database.session.length, 0);
});

