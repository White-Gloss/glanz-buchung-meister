import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getWhatsAppStatus, sendWhatsAppTest, type WhatsAppStatus } from "@/lib/whatsapp.functions";

/**
 * WHATSAPP-BENACHRICHTIGUNG IM ADMINBEREICH
 * ------------------------------------------
 * Zeigt, ob die Anbindung steht, und erlaubt einen echten Testversand.
 *
 * Anders als beim Assistenten bleibt die Karte auch dann sichtbar, wenn
 * nichts eingerichtet ist — hier ist das Fehlen der Einrichtung genau die
 * Auskunft, die der Betrieb braucht: Ohne sie kommt keine Nachricht aufs
 * Handy, und das würde sonst erst auffallen, wenn eine Anfrage untergeht.
 */
export function WhatsAppStatusCard() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const fetchStatus = useServerFn(getWhatsAppStatus);
  const test = useServerFn(sendWhatsAppTest);

  useEffect(() => {
    let aktiv = true;
    fetchStatus()
      .then((result) => aktiv && setStatus(result))
      .catch(() => aktiv && setStatus(null));
    return () => {
      aktiv = false;
    };
  }, [fetchStatus]);

  async function testen() {
    setLaeuft(true);
    try {
      const ergebnis = await test({});
      if (ergebnis.sent) {
        toast.success("Testnachricht verschickt — schauen Sie auf Ihr Handy.");
      } else {
        toast.error(ergebnis.reason ?? "Der Versand ist fehlgeschlagen.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Der Versand ist fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  }

  if (!status) return null;

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <MessageCircle aria-hidden className="size-4 text-primary" />
        <h2 className="display-card text-sm uppercase">WhatsApp-Benachrichtigung</h2>
      </div>

      {status.configured ? (
        <>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Aktiv. Bei jeder Terminanfrage und jeder Zustandsmeldung geht eine Nachricht an{" "}
            <span className="text-foreground/80">{status.to}</span>.
          </p>

          {!status.templateSet && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="flex items-center gap-2 text-xs font-medium text-amber-300">
                <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
                Keine Nachrichtenvorlage hinterlegt
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Ohne genehmigte Vorlage nimmt Meta eine Nachricht nur an, wenn Sie in den letzten 24
                Stunden selbst geschrieben haben. Für den Dauerbetrieb wird{" "}
                <code>WHATSAPP_TEMPLATE</code> gebraucht.
              </p>
            </div>
          )}

          <Button variant="outline" size="sm" className="mt-4" onClick={testen} loading={laeuft}>
            Testnachricht senden
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Noch nicht eingerichtet — es geht keine Nachricht aufs Handy. Die
            E-Mail-Benachrichtigung läuft davon unabhängig weiter.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Nötig sind <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_ACCESS_TOKEN</code> und{" "}
            <code>WHATSAPP_TO</code> in <code>/etc/white-gloss/environment</code>. Die Schritte
            stehen in der Projektdokumentation unter <code>docs/whatsapp-benachrichtigung.md</code>.
          </p>
        </>
      )}
    </section>
  );
}
