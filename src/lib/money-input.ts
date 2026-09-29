/** Parses an operator's euro amount into cents. German input ("1.234,50", "178,00")
 * and a plain decimal point ("1.50") are accepted; anything ambiguous is rejected. */
export function parseEuroInput(raw: string): number | null {
  const value = raw.trim().replace(/\s|€/g, "");
  let normalized: string | null = null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value) || /^\d+(,\d{1,2})?$/.test(value))
    normalized = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(value)) normalized = value;
  if (normalized === null) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
