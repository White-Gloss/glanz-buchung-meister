export type ReplyDraftInput = {
  sender: string | null;
  subject: string | null;
  body: string;
  packageHint?: string | null;
};

/**
 * Erzeugt einen kurzen, prüfbaren Antwortentwurf für den Operator.
 * Sendet nichts — nur Text für replyInbox / Posteingang.
 */
export function buildReplyDraft(input: ReplyDraftInput): string {
  const name =
    (input.sender ?? "Kunde").split(/[<(]/)[0]?.trim().replace(/^"+|"+$/g, "") || "Kunde";
  const pkg = input.packageHint ? ` zum Paket ${input.packageHint}` : "";
  return [
    `Guten Tag ${name},`,
    "",
    `vielen Dank für Ihre Nachricht${pkg}. Gerne schauen wir uns Ihren Wunschtermin an und melden uns mit einem konkreten Vorschlag.`,
    "",
    "Freundliche Grüße",
    "White Gloss Detailing",
  ].join("\n");
}
