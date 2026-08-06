import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getMailSetupStatus,
  sendMailSelfTest,
  type MailSetupStatus,
} from "@/lib/mailDiagnostics.functions";

/**
 * Zeigt im Admin-Bereich, ob der E-Mail-Versand eingerichtet ist, und
 * erlaubt eine Testmail an die eigene Adresse.
 *
 * Hintergrund: Ob Mails ankommen, hängt an den Umgebungsvariablen beim
 * Hoster und an der Domainverifizierung bei Resend — beides außerhalb des
 * Codes. Ohne diese Karte wäre die einzige Fehlerquelle das Server-
 * Protokoll, an das man ohne Hosting-Zugang nicht herankommt.
 */
export function MailStatusCard() {
  const [status, setStatus] = useState<MailSetupStatus | null>(null);
  const [sending, setSending] = useState(false);
  const fetchStatus = useServerFn(getMailSetupStatus);
  const sendTest = useServerFn(sendMailSelfTest);

  useEffect(() => {
    let active = true;
    fetchStatus()
      .then((result) => active && setStatus(result))
      .catch(() => active && setStatus(null));
    return () => {
      active = false;
    };
  }, [fetchStatus]);

  async function handleTest() {
    setSending(true);
    try {
      const result = await sendTest({});
      if (result.sent) {
        toast.success(`Testmail an ${result.to} versendet.`);
      } else {
        // Der Grund kommt unverändert von Resend und ist die eigentliche
        // Information — z. B. „domain is not verified".
        toast.error(result.reason || "Der Versand ist fehlgeschlagen.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Der Versand ist fehlgeschlagen.");
    } finally {
      setSending(false);
    }
  }

  if (!status) return null;

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Mail aria-hidden className="size-4 text-primary" />
            <h2 className="display-card text-sm uppercase">E-Mail-Versand</h2>
            {status.configured ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">
                <CheckCircle2 aria-hidden className="size-3" />
                eingerichtet
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-300">
                <AlertTriangle aria-hidden className="size-3" />
                nicht eingerichtet
              </span>
            )}
          </div>

          {status.configured ? (
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Absender</dt>
              <dd className="truncate text-foreground/85">{status.from}</dd>
              <dt className="text-muted-foreground">Interne Meldungen an</dt>
              <dd className="truncate text-foreground/85">{status.ownerTo}</dd>
            </dl>
          ) : (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {status.apiKeySet
                ? "MAIL_FROM fehlt. Ohne Absenderzeile verschickt Resend nichts — beides muss gesetzt sein."
                : "RESEND_API_KEY und MAIL_FROM sind beim Hoster zu hinterlegen. Solange sie fehlen, gehen weder Eingangs- noch Terminbestätigung raus. Buchungen werden trotzdem gespeichert."}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          loading={sending}
          disabled={!status.configured || !status.testTo}
          title={
            status.configured
              ? `Testmail an ${status.testTo ?? "die eigene Adresse"} senden`
              : "Zuerst RESEND_API_KEY und MAIL_FROM hinterlegen"
          }
          onClick={handleTest}
        >
          {sending ? null : <Send aria-hidden className="size-4" />}
          Testmail an mich
        </Button>
      </div>
    </section>
  );
}
