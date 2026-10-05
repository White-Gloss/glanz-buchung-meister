/** The private panel owns operations by default; legacy providers require an explicit mode. */
export function bookingBackend(): "panel" | "bitrix" | "roapp" {
  const mode = process.env.BOOKING_OPERATIONS?.trim() || "panel";
  if (mode !== "panel" && mode !== "bitrix" && mode !== "roapp")
    throw new Error("booking_backend_invalid");
  return mode;
}
export function panelOnlyEnabled(): boolean {
  return bookingBackend() === "panel";
}
export function assertWebsiteOperationsActive(): void {
  if (panelOnlyEnabled())
    throw new Error("Aufträge bitte ausschließlich im White-Gloss-Panel bearbeiten.");
}
export function roappOnlyEnabled(): boolean {
  return bookingBackend() === "roapp";
}
export function roappAccountScope(): string {
  const scope = process.env.ROAPP_ACCOUNT_SCOPE?.trim() || "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}$/.test(scope) || scope === "legacy")
    throw new Error("roapp_account_scope_missing");
  return scope;
}
export function roappCutoverAt(): string {
  const raw = process.env.ROAPP_CUTOVER_AT || "";
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(Date.parse(raw)))
    throw new Error("roapp_cutover_missing");
  return new Date(raw).toISOString();
}
export function assertBitrixActive(): void {
  if (bookingBackend() !== "bitrix")
    throw new Error(
      panelOnlyEnabled()
        ? "Die Auftragsbearbeitung erfolgt im White-Gloss-Panel."
        : "Die Auftragsbearbeitung erfolgt jetzt in RO App.",
    );
}
export function assertWebsiteApprovalEnabled(): void {
  if (panelOnlyEnabled())
    throw new Error("Preis und Termin bitte im White-Gloss-Panel prüfen und freigeben.");
  if (roappOnlyEnabled())
    throw new Error("Preis und Termin bitte im RO-Auftrag prüfen und freigeben.");
}
