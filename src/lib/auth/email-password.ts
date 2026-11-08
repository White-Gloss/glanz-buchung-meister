/**
 * Existing operator accounts can sign in with email and password.
 * Public email/password account creation is disabled on the server.
 */
export const emailAndPasswordEnabled = true;
export const emailSignUpEnabled = false;

/** Shared with the real server and the isolated auth boundary regression tests. */
export const emailPasswordOptions = {
  enabled: emailAndPasswordEnabled,
  disableSignUp: true,
};
