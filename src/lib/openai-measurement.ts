export const OPENAI_CONSENT_VERSION = "booking-2026-11-08";

export type OpenAiMeasurement = {
  consent: typeof OPENAI_CONSENT_VERSION;
  oppref?: string;
};

/** Per-request consent only: no cookies, storage, or reading the URL before opt-in. */
export function bookingMeasurement(accepted: boolean, readSearch: () => string): OpenAiMeasurement | undefined {
  if (!accepted) return undefined;
  const oppref = new URLSearchParams(readSearch()).get("oppref");
  return {
    consent: OPENAI_CONSENT_VERSION,
    ...(oppref && oppref.length <= 2048 && oppref.trim() ? { oppref } : {}),
  };
}
