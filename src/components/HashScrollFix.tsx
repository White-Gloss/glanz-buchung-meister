import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * KORREKTUR DER ANKER-NAVIGATION
 * -------------------------------
 * Menüpunkte wie „B2B & Flotten" oder „Termin anfragen" springen über
 * einen Anker (`/#b2b`, `/#buchung`) auf die Startseite.
 *
 * DAS PROBLEM: Abschnitte unterhalb der Sichtfläche nutzen
 * `content-visibility: auto`. Solange sie nicht gerendert sind, schätzt
 * der Browser ihre Höhe (`contain-intrinsic-size`, hier 800px). Der
 * Sprung zum Anker erfolgt anhand dieser Schätzung. Sobald die echten
 * Abschnitte gerendert werden, verschiebt sich alles darunter — bei
 * `#b2b` gemessen um über 1000px. Der Besucher landet weit unterhalb des
 * Ziels, im Zweifel am Seitenende. Derselbe Effekt entsteht durch den
 * nachgeladenen Buchungsassistenten.
 *
 * DIE LÖSUNG: Nach dem Sprung so lange nachjustieren, bis die Position
 * des Ziels stabil bleibt. Der Abgleich läuft über eine knappe Sekunde
 * und bricht ab, sobald jemand selbst scrollt — sonst würde man den
 * Besucher gegen seinen Willen festhalten.
 *
 * Der Abstand nach oben berücksichtigt die feste Kopfzeile; ohne ihn
 * verschwindet die Überschrift des Ziels darunter.
 */

/** Höhe der klebenden Kopfzeile plus etwas Luft. */
const HEADER_OFFSET = 96;

/** So lange wird nachjustiert, während die Abschnitte ihre Höhe finden. */
const SETTLE_MS = 1200;

export function HashScrollFix() {
  const hash = useRouterState({ select: (state) => state.location.hash });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = (hash || "").replace(/^#/, "");
    if (!id) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let abgebrochen = false;
    let letzteZielposition = -1;

    // Eigenes Scrollen des Besuchers beendet die Korrektur sofort.
    function onUserScroll() {
      abgebrochen = true;
    }

    function zielPosition(element: HTMLElement) {
      return Math.max(0, element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET);
    }

    function justiere() {
      const element = document.getElementById(id);
      if (!element) return;
      const ziel = zielPosition(element);
      // Nur bewegen, wenn sich das Ziel gegenüber der letzten Messung
      // verschoben hat und wir spürbar danebenstehen. Sonst würde jeder
      // Frame ein neues Scrollen auslösen.
      if (Math.abs(ziel - letzteZielposition) < 2 && Math.abs(window.scrollY - ziel) < 4) return;
      letzteZielposition = ziel;
      window.scrollTo({ top: ziel, behavior: reduceMotion ? "auto" : "smooth" });
    }

    const start = performance.now();
    function tick() {
      if (abgebrochen) return;
      justiere();
      if (performance.now() - start < SETTLE_MS) {
        window.requestAnimationFrame(tick);
      }
    }

    // Erst im nächsten Frame beginnen: Der Router hat den Sprung dann
    // bereits versucht, und das Ziel existiert im DOM.
    const startId = window.requestAnimationFrame(() => {
      window.addEventListener("wheel", onUserScroll, { passive: true, once: true });
      window.addEventListener("touchmove", onUserScroll, { passive: true, once: true });
      tick();
    });

    return () => {
      abgebrochen = true;
      window.cancelAnimationFrame(startId);
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchmove", onUserScroll);
    };
  }, [hash]);

  return null;
}
