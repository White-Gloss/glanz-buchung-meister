import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * SEITENAUFRUFE AN META MELDEN
 * -----------------------------
 * Der Meta-Pixel meldet „PageView" nur einmal, nämlich beim Laden seines
 * Skripts. Diese Website wechselt die Ansicht jedoch im Browser, ohne das
 * Dokument neu zu laden. Ohne diese Ergänzung zählte Meta pro Besuch genau
 * einen Seitenaufruf — auch wenn jemand Preise, Leistungen und mehrere
 * Stadtseiten durchsieht.
 *
 * Folgen hätte das vor allem für die Werbung: Zielgruppen nach dem Muster
 * „hat die Preisseite besucht" blieben leer, und die Auswertung, welche
 * Anzeige zu welchem Weg durch die Website führt, wäre nicht möglich.
 *
 * DER ERSTE AUFRUF WIRD BEWUSST ÜBERSPRUNGEN: Für den hat der Ladeschnipsel
 * bereits ein „PageView" gesendet. Ein zweites hier würde den Einstieg jedes
 * Besuchs doppelt zählen.
 *
 * Ohne Einwilligung passiert nichts — das prüft `trackPageView` selbst noch
 * einmal, unabhängig davon, ob dieser Baustein eingebunden ist.
 */
export function MetaPageViews() {
  const pfad = useRouterState({ select: (state) => state.location.pathname });
  const ersterAufruf = useRef(true);

  useEffect(() => {
    if (ersterAufruf.current) {
      ersterAufruf.current = false;
      return;
    }
    // Nachladen statt fester Einbindung: Auf Seiten ohne Einwilligung soll
    // der Pixel-Code gar nicht erst im Bündel landen.
    void import("@/lib/metaPixel").then((m) => m.trackPageView());
  }, [pfad]);

  return null;
}
