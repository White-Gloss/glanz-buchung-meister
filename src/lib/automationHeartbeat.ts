/**
 * BEWERTUNG DES LEBENSZEICHENS
 * -----------------------------
 * Übersetzt „Geheimnis gesetzt?" und „wann lief es zuletzt?" in die Aussage,
 * die im Adminbereich stehen soll.
 *
 * WARUM DAS NICHT DASSELBE IST
 * Bisher zeigte die Oberfläche „bereit für Scheduler", sobald
 * `REMINDER_CRON_SECRET` hinterlegt war. Das ist die Aussage, dass die Tür
 * ein Schloss hat — nicht, dass jemand hindurchgeht. Ob überhaupt etwas den
 * Endpunkt anstößt, stand nirgends, und ein seit Wochen stiller Zeitgeber
 * sah genauso aus wie ein laufender.
 *
 * KEIN LEBENSZEICHEN HEISST NICHT „KAPUTT". Es kann ebenso bedeuten, dass
 * die Migration noch nicht eingespielt ist oder seither kein Lauf
 * stattfand. Die Formulierungen sagen deshalb, was bekannt ist, und nicht
 * mehr.
 */

/** Als „läuft" gilt ein Lauf, der nicht länger als so lange her ist. */
export const FRISCH_STUNDEN = 3;

export type HeartbeatBewertung = {
  status: string;
  /**
   * Nur diese beiden: Ein Lebenszeichen ist entweder da und frisch, oder es
   * verlangt Aufmerksamkeit. Den neutralen Ton der Oberfläche vergibt die
   * Ansicht selbst, wenn der Status gar nicht erst geladen werden konnte.
   */
  tone: "ready" | "pending";
  detail: string;
};

/** Menschliche Abstandsangabe, bewusst grob. */
export function abstandInWorten(millisekunden: number): string {
  const minuten = Math.floor(millisekunden / 60_000);
  if (minuten < 1) return "gerade eben";
  if (minuten < 60) return `vor ${minuten} Minute${minuten === 1 ? "" : "n"}`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Stunde${stunden === 1 ? "" : "n"}`;
  const tage = Math.floor(stunden / 24);
  return `vor ${tage} Tag${tage === 1 ? "" : "en"}`;
}

export function bewerteHeartbeat(eingabe: {
  secretGesetzt: boolean;
  letzterLauf: string | null;
  letzterLaufDetail: string | null;
  jetzt?: Date;
}): HeartbeatBewertung {
  if (!eingabe.secretGesetzt) {
    return {
      status: "noch nicht aktiv",
      tone: "pending",
      detail:
        "Server-Variable REMINDER_CRON_SECRET fehlt; ohne sie lehnt der Endpunkt jeden Automationslauf ab.",
    };
  }

  const jetzt = eingabe.jetzt ?? new Date();
  const zeitpunkt = eingabe.letzterLauf ? new Date(eingabe.letzterLauf) : null;

  if (!zeitpunkt || Number.isNaN(zeitpunkt.getTime())) {
    return {
      status: "Zeitgeber unbestätigt",
      tone: "pending",
      detail:
        "REMINDER_CRON_SECRET ist hinterlegt, aber es liegt noch kein Lauf vor. " +
        "Das heißt nicht zwingend, dass nichts läuft — es kann auch sein, dass die " +
        "Aufzeichnung erst neu ist. Prüfen und einrichten: siehe den Abschnitt " +
        "\u201eTerminerinnerungen: der Zeitgeber\u201c in docs/ionos-vps-bootstrap.md.",
    };
  }

  const abstand = jetzt.getTime() - zeitpunkt.getTime();
  const zaehler = eingabe.letzterLaufDetail ? ` (${eingabe.letzterLaufDetail})` : "";
  const wann = abstandInWorten(Math.max(0, abstand));

  if (abstand <= FRISCH_STUNDEN * 3_600_000) {
    return {
      status: "läuft",
      tone: "ready",
      detail: `Letzter Lauf ${wann}${zaehler}.`,
    };
  }

  return {
    status: "seit Längerem still",
    tone: "pending",
    detail:
      `Letzter Lauf ${wann}${zaehler}. Erwartet wird stündlich. ` +
      "Zeitgeber prüfen: systemctl list-timers white-gloss-reminder.timer",
  };
}
