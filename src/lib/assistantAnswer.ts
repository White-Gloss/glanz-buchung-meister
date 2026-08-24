/**
 * AUSWERTUNG EINER MODELLANTWORT
 * -------------------------------
 * Getrennt vom SDK-Aufruf, damit die Fallunterscheidung ohne Netzzugriff
 * geprüft werden kann. Sie entscheidet, was der Betrieb im Adminbereich zu
 * sehen bekommt — und das ist bei einem Entwurf, der an Kundschaft geht,
 * kein Nebenschauplatz.
 */

/** Nur die Angaben, die für die Auswertung zählen. */
export type AssistantAnswerInput = {
  /** `stop_reason` der Antwort; `null`, solange gestreamt wird. */
  stopReason: string | null;
  /** Bereits zusammengesetzter Text aller Textblöcke. */
  text: string;
};

export type AssistantAnswer = {
  text: string;
  /** Die Antwort lief in die Token-Obergrenze und bricht deshalb mitten im Satz ab. */
  truncated: boolean;
};

/** Angehängt, damit ein abgeschnittener Entwurf nicht versehentlich abgeschickt wird. */
export const TRUNCATION_NOTICE =
  "[Hinweis des Systems: Die Antwort wurde an der Längengrenze abgeschnitten und ist unvollständig. Bitte den Entwurf vor dem Verwenden ergänzen oder die Aufgabe kleiner stellen.]";

/**
 * Wertet eine abgeschlossene Antwort aus.
 *
 * Wirft bei einer Ablehnung und bei einer leeren Antwort — beides sind Fälle,
 * in denen es nichts zu zeigen gibt. Ein abgeschnittener, aber brauchbarer
 * Text wird dagegen zurückgegeben und ausdrücklich als unvollständig
 * gekennzeichnet: ihn wegzuwerfen wäre für den Betrieb schlechter als ihn
 * mit Warnung weiterzureichen.
 */
export function interpretAssistantAnswer(input: AssistantAnswerInput): AssistantAnswer {
  const text = input.text.trim();

  if (input.stopReason === "refusal") {
    throw new Error(
      "Die Anfrage wurde abgelehnt. Bitte formulieren Sie sie anders oder ohne heikle Inhalte.",
    );
  }

  if (!text) {
    // Bei erschöpfter Obergrenze ohne jeden Text ging das gesamte Budget in
    // die Überlegung des Modells. Der allgemeine Hinweis „erneut versuchen"
    // führt hier in die Irre, weil ein zweiter Versuch genauso endet.
    if (input.stopReason === "max_tokens") {
      throw new Error(
        "Die Längengrenze war erreicht, bevor Text entstanden ist. Bitte die Aufgabe kleiner stellen.",
      );
    }
    throw new Error("Das Modell hat keine verwertbare Antwort geliefert. Bitte erneut versuchen.");
  }

  if (input.stopReason === "max_tokens") {
    return { text: `${text}\n\n${TRUNCATION_NOTICE}`, truncated: true };
  }

  return { text, truncated: false };
}
