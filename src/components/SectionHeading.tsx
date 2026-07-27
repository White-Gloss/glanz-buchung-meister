import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Kleiner Vorspann über der Überschrift (optional) */
  eyebrow?: string;
  /** Hauptüberschrift */
  title: ReactNode;
  /** Beschreibungstext unter der Überschrift (optional) */
  text?: ReactNode;
  /** Semantische Ebene – Optik bleibt über `level` steuerbar */
  as?: "h1" | "h2" | "h3";
  /** Größenstufe aus dem zentralen Typo-System (src/styles.css) */
  level?: "hero" | "page" | "section" | "sub";
  className?: string;
  /** Zusatzklassen nur für die Überschrift (z. B. max-w-2xl, text-gradient) */
  titleClassName?: string;
};

const levelClass = {
  hero: "display-hero",
  page: "display-page",
  section: "display-section",
  sub: "display-sub",
} as const;

/**
 * Zentrale Überschriften-Komponente.
 * Sorgt für einheitliche Schriftstärke, Laufweite und Abstände
 * auf Startseite, Städte-Seiten und im Booking-Wizard.
 */
export function SectionHeading({
  eyebrow,
  title,
  text,
  as: Tag = "h2",
  level = "section",
  className,
  titleClassName,
}: Props) {
  return (
    <div className={cn("headline-stack", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Tag className={cn(levelClass[level], titleClassName)}>{title}</Tag>
      {text && <p className="text-muted-foreground">{text}</p>}
    </div>
  );
}
