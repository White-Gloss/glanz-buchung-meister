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

    let abgebrochen = false;

    /**
     * Jede Eingabe, mit der man scrollen kann, gilt als Wille des Besuchers:
     * Mausrad, Wischen, jede Taste (Leertaste, Bild auf/ab, Pos1/Ende,
     * Pfeiltasten) und jedes Drücken der Maus, womit auch das Ziehen der
     * Bildlaufleiste erfasst ist.
     *
     * Bewusst NICHT das `scroll`-Ereignis: Wenn die zunächst ausgelassenen
     * Abschnitte nachgerendert werden, verschiebt der Browser die Ansicht von
     * sich aus (Scroll-Anchoring) und löst dabei ebenfalls `scroll` aus. Die
     * Korrektur würde sich also selbst abbrechen — genau in dem Moment, für
     * den sie gebaut ist.
     */
    const ABBRUCH_EREIGNISSE = ["wheel", "touchmove", "keydown", "pointerdown"] as const;

    function onUserScroll() {
      abgebrochen = true;
    }

    function zielPosition(element: HTMLElement) {
      const roh = element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
      // Am Seitenende ist die Wunschposition nicht erreichbar. Ohne diese
      // Begrenzung liefen wir gegen einen Anschlag und setzten bei jedem
      // Einzelbild erneut dieselbe unerreichbare Position.
      const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return Math.min(Math.max(0, roh), maximum);
    }

    function justiere() {
      const element = document.getElementById(id);
      if (!element) return;
      const ziel = zielPosition(element);
      // Nur bewegen, wenn wir spürbar danebenstehen — sonst löste jeder
      // Einzelbild-Durchlauf ein neues Scrollen aus.
      if (Math.abs(window.scrollY - ziel) < 2) return;
      // Ausdrücklich "instant" und nicht "auto": Das Stylesheet setzt
      // `scroll-behavior: smooth` für die ganze Seite, und "auto" bedeutet
      // genau das — dem CSS folgen. Eine einmal gestartete Scroll-Animation
      // lässt sich aber nicht mehr abbrechen. Sie liefe weiter, nachdem der
      // Besucher längst selbst gescrollt hat, und zöge ihn zurück; das
      // Abbruch-Kennzeichen käme dagegen nicht an. "instant" setzt die
      // Position sofort und lässt sich damit jederzeit stoppen.
      window.scrollTo({ top: ziel, behavior: "instant" });
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
      for (const name of ABBRUCH_EREIGNISSE) {
        window.addEventListener(name, onUserScroll, { passive: true, once: true });
      }
      tick();
    });

    return () => {
      abgebrochen = true;
      window.cancelAnimationFrame(startId);
      for (const name of ABBRUCH_EREIGNISSE) {
        window.removeEventListener(name, onUserScroll);
      }
    };
  }, [hash]);

  return null;
}
