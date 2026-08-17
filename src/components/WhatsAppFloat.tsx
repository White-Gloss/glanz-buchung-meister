import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { company } from "@/lib/servicesConfig";

const defaultMessage = encodeURIComponent(
  "Hallo White Gloss, ich interessiere mich für eine Fahrzeugaufbereitung und hätte eine Frage.",
);

/**
 * Bereiche, über denen die Schaltfläche im Weg wäre. Am Telefon ist sie eine
 * breite Pille unten rechts und legt sich sonst über die Fußleiste des
 * Buchungsassistenten — also ausgerechnet über „Terminanfrage senden" und
 * über die Auswahl des bevorzugten Kontaktwegs.
 */
const AUSBLENDEN_BEI = "[data-hide-whatsapp]";

/**
 * Zeigt sich, sobald ein solcher Bereich im Bild ist. Der Ausgangszustand ist
 * bewusst „sichtbar": Ohne JavaScript oder bei fehlendem IntersectionObserver
 * bleibt alles wie zuvor, statt dass die Schaltfläche verschwindet.
 */
function useVerdecktEinFormular(): boolean {
  const [verdeckt, setVerdeckt] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const ziele = Array.from(document.querySelectorAll(AUSBLENDEN_BEI));
    if (ziele.length === 0) return;

    const sichtbare = new Set<Element>();
    const observer = new IntersectionObserver(
      (eintraege) => {
        for (const eintrag of eintraege) {
          if (eintrag.isIntersecting) sichtbare.add(eintrag.target);
          else sichtbare.delete(eintrag.target);
        }
        setVerdeckt(sichtbare.size > 0);
      },
      // Nur der untere Bildschirmrand zählt: Dort sitzt die Schaltfläche.
      { rootMargin: "0px 0px -55% 0px" },
    );

    ziele.forEach((ziel) => observer.observe(ziel));
    return () => observer.disconnect();
  }, []);

  return verdeckt;
}

export function WhatsAppFloat() {
  const href = `${company.whatsappHref}&text=${defaultMessage}`;
  const verdeckt = useVerdecktEinFormular();

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp-Chat mit White Gloss starten"
      aria-hidden={verdeckt}
      tabIndex={verdeckt ? -1 : undefined}
      className={[
        "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-[#071a0f] shadow-xl transition-all hover:scale-105 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 sm:bottom-6 sm:right-6 sm:grid sm:size-14 sm:px-0",
        verdeckt ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100",
      ].join(" ")}
    >
      <MessageCircle className="size-6" aria-hidden />
      <span className="sm:sr-only">WhatsApp</span>
    </a>
  );
}
