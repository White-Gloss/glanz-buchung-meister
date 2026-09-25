import { Instagram, ArrowUpRight } from "lucide-react";
import { site } from "@/data/site";
import { useId } from "react";

export function InstagramBadge() {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <a
      href={site.instagram}
      target="_blank"
      rel="noopener noreferrer"
      className="instagram-badge"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
    >
      <Instagram className="size-5 shrink-0" aria-hidden="true" />
      <span id={labelId} className="min-w-0">
        <span className="block text-xs text-muted">Einblicke aus der Werkstatt</span>{" "}
        <span className="block break-words text-sm">@{site.instagramHandle}</span>
      </span>
      <span id={descriptionId} className="sr-only">Instagram – öffnet in neuem Tab</span>
      <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
    </a>
  );
}
