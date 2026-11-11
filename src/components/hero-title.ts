import { createElement } from "react";

// These compounds had emergency word breaks in the real mobile browser checks.
// Keep source/SEO titles intact; soft hyphens affect only their presentation.
const breaks: Record<string, string> = {
  Fahrzeugpflege: "Fahr\u00adzeug\u00adpflege",
  Fahrzeugaufbereitung: "Fahr\u00adzeug\u00adauf\u00adbereitung",
  Keramikversiegelung: "Keramik\u00adver\u00adsiegelung",
  Langzeitschutz: "Langzeit\u00adschutz",
};

export function HeroTitle({ children }: { children: string }) {
  const visual = children.replace(
    /(^|[^\p{L}\p{N}])(Fahrzeugpflege|Fahrzeugaufbereitung|Keramikversiegelung|Langzeitschutz)(?=$|[^\p{L}\p{N}])/gu,
    (_, prefix: string, word: string) => prefix + breaks[word],
  );
  // PageHero provides the unchanged title as the heading's accessible name.
  return createElement("span", { "aria-hidden": true }, visual);
}
