import { getRequest } from "@tanstack/react-start/server";
import { gateIdentityEnabled } from "./gate-identity.server";
import { auth } from "./server";
import { createSessionVerifier, developmentUserAllowed } from "./session-policy";

/**
 * Resolve native Google, email/password and broker sessions through Better Auth
 * on every request. Provider credentials only configure sign-in; they must not
 * suppress verification of an existing same-origin session.
 *
 * The optional bearer token is used by the embedded live preview, whose cookies
 * may be partitioned. Better Auth's bearer plugin verifies that session token.
 * Production always requires a verified session, even if the preview auth flag
 * is false or DATABASE_URL is accidentally absent.
 */

export { authConfigured } from "./server";
export { DEV_USER_ID, UnauthorizedError, type VerifiedUser } from "./session-policy";

const verifier = createSessionVerifier({
  getRequestHeaders: () => getRequest()?.headers ?? null,
  readSession: (headers) => auth.api.getSession({ headers }),
  allowDevelopmentUser: () =>
    developmentUserAllowed({
      nodeEnv: process.env.NODE_ENV,
      authDisabled: process.env.VITE_AUTH_ENABLED?.trim() === "false",
      databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
      gateEnabled: gateIdentityEnabled(),
    }),
});

export const getSessionUser = verifier.getSessionUser;
export const requireUserId = verifier.requireUserId;
