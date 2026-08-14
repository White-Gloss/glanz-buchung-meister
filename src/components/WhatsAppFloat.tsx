import { MessageCircle } from "lucide-react";
import { company } from "@/lib/servicesConfig";

const defaultMessage = encodeURIComponent(
  "Hallo White Gloss, ich interessiere mich für eine Fahrzeugaufbereitung und hätte eine Frage.",
);

export function WhatsAppFloat() {
  const href = `${company.whatsappHref}&text=${defaultMessage}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp-Chat mit White Gloss starten"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-[#071a0f] shadow-xl transition-all hover:scale-105 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 sm:bottom-6 sm:right-6 sm:grid sm:size-14 sm:px-0"
    >
      <MessageCircle className="size-6" aria-hidden />
      <span className="sm:sr-only">WhatsApp</span>
    </a>
  );
}
