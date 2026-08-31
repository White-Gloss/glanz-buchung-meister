import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
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
      tabIndex={hidden ? -1 : undefined}
      className={[
        "fixed right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-wa px-4 text-sm font-semibold text-accent-fg shadow-lg transition-transform duration-200 ease-out hover:scale-105 sm:right-6 sm:bottom-6 sm:grid sm:size-14 sm:place-items-center sm:px-0",
        "bottom-[max(1rem,env(safe-area-inset-bottom))]",
        hidden ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100",
      ].join(" ")}
    >
      <MessageCircle className="size-6" aria-hidden />
      <span className="sm:sr-only">WhatsApp</span>
    </a>
  );
}
