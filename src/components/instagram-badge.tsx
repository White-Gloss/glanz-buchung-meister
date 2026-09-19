import { Instagram, ArrowUpRight } from "lucide-react";
import { site } from "@/data/site";

export function InstagramBadge() {
  return (
    <a
      href={site.instagram}
      target="_blank"
      rel="noopener noreferrer"
      className="instagram-badge"
      aria-label={`@${site.instagramHandle} auf Instagram – öffnet in neuem Tab`}
    >
      <Instagram className="size-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-xs text-muted">Einblicke aus der Werkstatt</span>
        <span className="block break-words text-sm">@{site.instagramHandle}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
    </a>
  );
}
