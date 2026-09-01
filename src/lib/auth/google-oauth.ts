import { EMBEDDED_GOOGLE_OAUTH } from "./google-oauth.generated.ts";

export type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

function trimEnv(key: string): string {
  return (process.env[key] || "").trim();
}

/** Native Google OAuth for IONOS (not the Grok preview broker). */
export function googleOAuthCredentials(): GoogleOAuthCredentials | null {
  const clientId = trimEnv("GOOGLE_CLIENT_ID") || trimEnv("VITE_GOOGLE_CLIENT_ID") || EMBEDDED_GOOGLE_OAUTH?.clientId || "";
  const clientSecret = trimEnv("GOOGLE_CLIENT_SECRET") || EMBEDDED_GOOGLE_OAUTH?.clientSecret || "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleNativeLoginEnabled(): boolean {
  return googleOAuthCredentials() !== null;
}
