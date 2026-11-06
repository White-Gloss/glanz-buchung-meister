import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { processSteps } from "@/data/site";
import { DESKTOP_MOTION, useScrollMotion } from "@/lib/scroll-motion";
import { IconArrowRight } from "./icons";
import { RevealLines } from "./reveal-lines";

/** Leselinie im Viewport: dort leuchtet ein Schritt auf und dort steht die Lichtlinie. */
const READING_LINE = "62%";

/**
 * „So läuft’s bei uns“: links angepinnt (CSS sticky), rechts leuchten die
 * Phasen 01–04 nacheinander auf, eine Lichtlinie zeichnet den Fortschritt.
 * Ohne Desktop-Motion (Smartphone, Tablet, reduzierte Bewegung, kein JS)
 * bleibt eine vollständig lesbare, statische Zeitleiste.
 */
export function HomeProcess() {
  const section = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);

  useScrollMotion(
    DESKTOP_MOTION,
    ({ gsap, ScrollTrigger }) => {
      const timeline = list.current;
      if (!timeline) return;
      const steps = gsap.utils.toArray<HTMLElement>("li", timeline);
      timeline.dataset.live = "";

      // Lichtlinie: Fortschritt von der ersten bis zur letzten Phase, auf
      // derselben Leselinie gemessen wie die Phasen selbst – beides bleibt
      // dadurch exakt synchron.
      gsap.fromTo(
        timeline,
        { "--process-progress": 0 },
        {
          "--process-progress": 1,
          ease: "none",
          scrollTrigger: {
            trigger: timeline,
            start: `top ${READING_LINE}`,
            end: `bottom ${READING_LINE}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );

      // Aktiv ist die letzte Phase, deren Beginn die Leselinie erreicht hat;
      // nach der letzten Phase bleibt sie leuchtend stehen. Die Marker
      // existieren erst nach create(); ein Refresh währenddessen wird ignoriert.
      let markers: Array<{ start: number; scroll(): number }> = [];
      const sync = () => {
        if (!markers.length || markers.length !== steps.length) return;
        const position = markers[0].scroll();
        let active = -1;
        markers.forEach((marker, index) => {
          if (position >= marker.start) active = index;
        });
        steps.forEach((step, index) => step.classList.toggle("is-active", index === active));
      };
      markers = steps.map((step) =>
        ScrollTrigger.create({
          trigger: step,
          start: `top ${READING_LINE}`,
          end: `bottom ${READING_LINE}`,
          onToggle: sync,
          onRefresh: sync,
        }),
      );
      sync();

      return () => {
        delete timeline.dataset.live;
        steps.forEach((step) => step.classList.remove("is-active"));
      };
    },
    section,
    section,
  );

  return (
    <section
      ref={section}
      className="home-craft mx-auto max-w-7xl px-4 sm:px-6"
      aria-labelledby="craft-heading"
    >
      <header>
        <p className="kicker">Prozess</p>
        <h2 id="craft-heading" className="heading-2 mt-4" data-lines>
          <RevealLines lines={["So läuft’s bei uns."]} />
        </h2>
        <Link to="/qualitaet" className="atelier-text-link">
          Unser Ablauf im Detail <IconArrowRight aria-hidden />
        </Link>
      </header>
      <ol ref={list} className="home-process">
        {processSteps.map((step) => (
          <li key={step.n}>
            <span>{step.n}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
