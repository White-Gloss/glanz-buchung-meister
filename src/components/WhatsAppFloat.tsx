import { MessageCircle } from "lucide-react";
import { company } from "@/lib/servicesConfig";

const defaultMessage = encodeURIComponent(
  "Hallo White Gloss, ich interessiere mich für eine Fahrzeugaufbereitung und hätte eine Frage.",
);

export function WhatsAppFloat() {
  const href = `${company.whatsappHref}?text=${defaultMessage}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp-Chat mit White Gloss starten"
      className="fixed bottom-6 right-6 z-50 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
    >
      <MessageCircle className="size-6" aria-hidden />
      <span className="sr-only">WhatsApp</span>
    </a>
  );
}
