import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSessionVerifier,
  developmentUserAllowed,
  DEV_USER_ID,
  resolveAuthConfiguration,
  UnauthorizedError,
} from "./session-policy.ts";

describe("independent app sign-in methods", () => {
  for (const method of ["google", "email"] as const) {
    it(`enables ${method} without enabling an unconfigured broker`, async () => {
      const configuration = resolveAuthConfiguration({
        authDisabled: false,
        googleEnabled: method === "google",
        emailEnabled: method === "email",
      });
      assert.deepEqual(configuration, { brokerEnabled: false, authConfigured: true });

      let verified = false;
      const verifier = createSessionVerifier({
        getRequestHeaders: () => new Headers({ cookie: "session=synthetic" }),
        readSession: async (headers) => {
          assert.equal(headers.get("cookie"), "session=synthetic");
          verified = true;
          return { user: { id: `${method}-user`, email: "operator@example.invalid" } };
        },
        allowDevelopmentUser: () => false,
      });
      assert.equal(await verifier.requireUserId(), `${method}-user`);
      assert.equal(verified, true);
    });
  }

  it("requires a complete broker credential pair, independent of native login", () => {
    const options = { authDisabled: false, googleEnabled: true, emailEnabled: true };
    assert.equal(
      resolveAuthConfiguration({ ...options, brokerClientId: "client" }).brokerEnabled,
      false,
    );
    assert.equal(
      resolveAuthConfiguration({ ...options, brokerClientSecret: "secret" }).brokerEnabled,
      false,
    );
    assert.equal(
      resolveAuthConfiguration({ ...options, brokerClientId: "client", brokerClientSecret: "  " })
        .brokerEnabled,
      false,
    );
    assert.equal(
      resolveAuthConfiguration({
        ...options,
        brokerClientId: "client",
        brokerClientSecret: "secret",
      }).brokerEnabled,
      true,
    );
  });

  it("the preview off-switch disables the broker while retaining native logins", () => {
    assert.deepEqual(
      resolveAuthConfiguration({
        authDisabled: true,
        brokerClientId: "client",
        brokerClientSecret: "secret",
        googleEnabled: true,
        emailEnabled: true,
      }),
      { brokerEnabled: false, authConfigured: true },
    );
  });
});

describe("development fallback boundaries", () => {
  const localPreview = {
    authDisabled: true,
    databaseConfigured: false,
    gateEnabled: false,
  };

  it("requires an explicit development/test environment and preview off-switch", () => {
    assert.equal(developmentUserAllowed({ ...localPreview, nodeEnv: "development" }), true);
    assert.equal(developmentUserAllowed({ ...localPreview, nodeEnv: "test" }), true);
    for (const nodeEnv of ["production", "staging", undefined]) {
      assert.equal(developmentUserAllowed({ ...localPreview, nodeEnv }), false);
    }
    assert.equal(
      developmentUserAllowed({ ...localPreview, nodeEnv: "development", authDisabled: false }),
      false,
    );
  });

  it("never shares a development identity against a real database or gate", () => {
    assert.equal(
      developmentUserAllowed({ ...localPreview, nodeEnv: "development", databaseConfigured: true }),
      false,
    );
    assert.equal(
      developmentUserAllowed({ ...localPreview, nodeEnv: "test", gateEnabled: true }),
      false,
    );
  });

  for (const databaseConfigured of [false, true]) {
    it(`rejects unsigned production requests with VITE_AUTH_ENABLED=false and database=${databaseConfigured}`, async () => {
      let reads = 0;
      const verifier = createSessionVerifier({
        getRequestHeaders: () => new Headers(),
        readSession: async () => {
          reads += 1;
          return null;
        },
        allowDevelopmentUser: () =>
          developmentUserAllowed({
            ...localPreview,
            nodeEnv: "production",
            databaseConfigured,
          }),
      });
      await assert.rejects(verifier.requireUserId(), (error: unknown) => {
        assert.ok(error instanceof UnauthorizedError);
        assert.equal(error.status, 401);
        assert.equal(error.message, "Unauthorized");
        return true;
      });
      assert.equal(reads, 1);
    });
  }

  it("uses a verified identity before considering the local development fallback", async () => {
    const verifier = createSessionVerifier({
      getRequestHeaders: () => new Headers(),
      readSession: async () => ({ user: { id: "signed-in-user" } }),
      allowDevelopmentUser: () => true,
    });
    assert.equal(await verifier.requireUserId(), "signed-in-user");
    assert.deepEqual(await verifier.getSessionUser(), { id: "signed-in-user", email: null });
    const preview = createSessionVerifier({
      getRequestHeaders: () => new Headers(),
      readSession: async () => null,
      allowDevelopmentUser: () => true,
    });
    assert.equal(await preview.requireUserId(), DEV_USER_ID);
  });
});

describe("session verification", () => {
  it("forwards a preview bearer token for verification without changing request headers", async () => {
    const requestHeaders = new Headers({
      authorization: "Bearer original",
      cookie: "session=synthetic",
    });
    const verifier = createSessionVerifier({
      getRequestHeaders: () => requestHeaders,
      readSession: async (headers) => {
        assert.equal(headers.get("authorization"), "Bearer forwarded");
        assert.equal(headers.get("cookie"), "session=synthetic");
        return { user: { id: "verified-by-auth-server" } };
      },
      allowDevelopmentUser: () => false,
    });
    assert.equal(await verifier.requireUserId("forwarded"), "verified-by-auth-server");
    assert.equal(requestHeaders.get("authorization"), "Bearer original");
  });

  it("does not turn an unverified bearer token into a user", async () => {
    const verifier = createSessionVerifier({
      getRequestHeaders: () => new Headers(),
      readSession: async () => null,
      allowDevelopmentUser: () => false,
    });
    await assert.rejects(verifier.requireUserId("unverified-token"), UnauthorizedError);
  });

  it("rejects requests without a request context", async () => {
    const verifier = createSessionVerifier({
      getRequestHeaders: () => null,
      readSession: async () => {
        throw new Error("must not run");
      },
      allowDevelopmentUser: () => false,
    });
    assert.equal(await verifier.getSessionUser(), null);
    await assert.rejects(verifier.requireUserId(), UnauthorizedError);
  });

  it("does not hide a verification failure behind a development identity", async () => {
    const failure = new Error("session verification unavailable");
    const verifier = createSessionVerifier({
      getRequestHeaders: () => new Headers(),
      readSession: async () => {
        throw failure;
      },
      allowDevelopmentUser: () => true,
    });
    await assert.rejects(verifier.requireUserId(), (error) => error === failure);
  });
});
