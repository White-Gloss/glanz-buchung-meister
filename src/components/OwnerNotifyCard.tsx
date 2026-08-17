import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BellRing, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getOwnerNotifyStatus,
  sendNotifyTest,
  type NotifyChannel,
  type OwnerNotifyStatus,
} from "@/lib/ownerNotify.functions";

/**
 * SOFORTBENACHRICHTIGUNG IM ADMINBEREICH
 * ---------------------------------------
 * Zeigt für jeden Weg, ob er steht, und erlaubt je einen echten Testversand.
 *
 * Die Karte bleibt auch dann sichtbar, wenn nichts eingerichtet ist. Anders
 * als beim Assistenten ist das Fehlen hier die eigentliche Auskunft: Ohne
 * eingerichteten Weg kommt keine Meldung aufs Handy, und das würde sonst
 * erst auffallen, wenn eine Anfrage untergeht.
 */
export function OwnerNotifyCard() {
  const [status, setStatus] = useState<OwnerNotifyStatus | null>(null);
  const [laeuft, setLaeuft] = useState<NotifyChannel | null>(null);

  const fetchStatus = useServerFn(getOwnerNotifyStatus);
  const test = useServerFn(sendNotifyTest);

  useEffect(() => {
    let aktiv = true;
    fetchStatus()
      .then((result) => aktiv && setStatus(result))
      .catch(() => aktiv && setStatus(null));
    return () => {
      aktiv = false;
    };
  }, [fetchStatus]);

  async function testen(channel: NotifyChannel) {
    setLaeuft(channel);
    try {
      const ergebnis = await test({ data: { channel } });
      if (ergebnis.sent) toast.success("Testnachricht verschickt — schauen Sie auf Ihr Handy.");
      else toast.error(ergebnis.reason ?? "Der Versand ist fehlgeschlagen.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Der Versand ist fehlgeschlagen.");
    } finally {
      setLaeuft(null);
    }
  }

  if (!status) return null;

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <BellRing aria-hidden className="size-4 text-primary" />
        <h2 className="display-card text-sm uppercase">Sofortbenachrichtigung</h2>
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {status.any
          ? "Bei jeder Terminanfrage und jeder Zustandsmeldung geht sofort eine Nachricht aufs Handy. Die E-Mail läuft davon unabhängig weiter."
          : "Noch kein Weg eingerichtet — es geht keine Nachricht aufs Handy. Die E-Mail-Benachrichtigung läuft unabhängig davon weiter."}
      </p>

      <div className="mt-5 space-y-3">
        <Kanal
          name="Telegram"
          aktiv={status.telegram}
          hinweis="Am einfachsten einzurichten: Bot anlegen, einmal anschreiben, zwei Werte auf den Server."
          variablen={["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]}
          laeuft={laeuft === "telegram"}
          gesperrt={laeuft !== null}
          onTest={() => testen("telegram")}
        />

        <Kanal
          name="WhatsApp"
          aktiv={status.whatsapp}
          hinweis={
            status.whatsapp && status.whatsappTo
              ? `Nachrichten gehen an ${status.whatsappTo}.`
              : "Aufwendiger: Meta-Konto, genehmigte Vorlage, eigene Absendernummer."
          }
          variablen={["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_TO"]}
          laeuft={laeuft === "whatsapp"}
          gesperrt={laeuft !== null}
          onTest={() => testen("whatsapp")}
          warnung={
            status.whatsapp && !status.whatsappTemplateSet
              ? "Keine Vorlage hinterlegt. Ohne WHATSAPP_TEMPLATE nimmt Meta eine Nachricht nur an, wenn Sie in den letzten 24 Stunden selbst geschrieben haben."
              : undefined
          }
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Einrichtung: <code>docs/telegram-benachrichtigung.md</code> beziehungsweise{" "}
        <code>docs/whatsapp-benachrichtigung.md</code>. Die Zugangsdaten gehören ausschließlich in{" "}
        <code>/etc/white-gloss/environment</code>.
      </p>
    </section>
  );
}

function Kanal({
  name,
  aktiv,
  hinweis,
  variablen,
  laeuft,
  gesperrt,
  onTest,
  warnung,
}: {
  name: string;
  aktiv: boolean;
  hinweis: string;
  variablen: string[];
  laeuft: boolean;
  gesperrt: boolean;
  onTest: () => void;
  warnung?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex size-5 items-center justify-center rounded-full ${
              aktiv ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-muted-foreground"
            }`}
          >
            {aktiv ? <Check aria-hidden className="size-3" /> : null}
          </span>
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">
            {aktiv ? "eingerichtet" : "nicht eingerichtet"}
          </span>
        </div>

        {aktiv && (
          <Button variant="outline" size="sm" onClick={onTest} loading={laeuft} disabled={gesperrt}>
            Testnachricht
          </Button>
        )}
      </div>

      <p className="mt-2 text-xs leading-5 text-muted-foreground">{hinweis}</p>

      {!aktiv && (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Nötig:{" "}
          {variablen
            .map((v) => <code key={v}>{v}</code>)
            .reduce((a, b) => (
              <>
                {a}, {b}
              </>
            ))}
        </p>
      )}

      {warnung && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-amber-300">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {warnung}
        </p>
      )}
    </div>
  );
}
