import { useEffect, useState } from "react";
import { IconMessage } from "./icons";
import { site } from "@/data/site";

export function WhatsAppFloat() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = Array.from(document.querySelectorAll("[data-hide-whatsapp]"));
    if (targets.length === 0) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setHidden(visible.size > 0);
      },
      { rootMargin: "0px 0px -55% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <a
      href={site.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      data-wa-float
      aria-hidden={hidden}
      aria-label="WhatsApp, öffnet in neuem Tab. Dabei werden Daten an Meta übertragen."
      tabIndex={hidden ? -1 : undefined}
      className={[
        "fixed right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-wa text-accent-fg shadow-lg sm:right-6 sm:bottom-6 sm:h-14 sm:w-14",
        "bottom-[max(1rem,env(safe-area-inset-bottom))]",
        hidden ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
    >
      <IconMessage className="size-6" />
    </a>
  );
}
