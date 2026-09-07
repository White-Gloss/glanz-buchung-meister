export type VerifiedUser = { id: string; email: string | null };

export const DEV_USER_ID = "dev-user";

/** Stable unauthorized contract used by server functions and login redirects. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export function resolveAuthConfiguration(options: {
  authDisabled: boolean;
  brokerClientId?: string;
  brokerClientSecret?: string;
  googleEnabled: boolean;
  emailEnabled: boolean;
}) {
  const brokerEnabled =
    !options.authDisabled &&
    Boolean(options.brokerClientId?.trim() && options.brokerClientSecret?.trim());
  return {
    brokerEnabled,
    // The preview switch does not disable the app's existing native logins.
    authConfigured: brokerEnabled || options.googleEnabled || options.emailEnabled,
  };
}

export function developmentUserAllowed(options: {
  nodeEnv?: string;
  authDisabled: boolean;
  databaseConfigured: boolean;
  gateEnabled: boolean;
}): boolean {
  return (
    (options.nodeEnv === "development" || options.nodeEnv === "test") &&
    options.authDisabled &&
    !options.databaseConfigured &&
    !options.gateEnabled
  );
}

type SessionResult = {
  user?: { id: string; email?: string | null } | null;
} | null;

/**
 * Provider-independent verification. Only the auth server's verified session
 * result may identify a caller; OAuth configuration is never proof of identity.
 */
export function createSessionVerifier(options: {
  getRequestHeaders: () => Headers | null;
  readSession: (headers: Headers) => Promise<SessionResult>;
  allowDevelopmentUser: () => boolean;
}) {
  async function getSessionUser(bearerToken?: string): Promise<VerifiedUser | null> {
    const requestHeaders = options.getRequestHeaders();
    if (!requestHeaders) return null;
    const headers = new Headers(requestHeaders);
    if (bearerToken) headers.set("Authorization", `Bearer ${bearerToken}`);
    const session = await options.readSession(headers);
    if (!session?.user?.id) return null;
    return { id: session.user.id, email: session.user.email ?? null };
  }

  async function requireUserId(bearerToken?: string): Promise<string> {
    const user = await getSessionUser(bearerToken);
    if (user) return user.id;
    if (options.allowDevelopmentUser()) return DEV_USER_ID;
    throw new UnauthorizedError();
  }

  return { getSessionUser, requireUserId };
}
