import { describe, expect, it } from "vitest";

import { effectiveMetaDescription, effectiveMetaTitle } from "./blogSeo";

describe("blog SEO metadata", () => {
  it("keeps a short explicit title unchanged", () => {
    expect(
      effectiveMetaTitle({ title: "Fallback", meta_title: "Kurzer Titel | White Gloss" }),
    ).toBe("Kurzer Titel | White Gloss");
  });

  it("limits long titles while preserving the brand suffix", () => {
    const title = effectiveMetaTitle({
      title: "Fallback",
      meta_title: "Keramikversiegelung: Haltbarkeit, Kosten und Grenzen | White Gloss",
    });

    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toMatch(/… \| White Gloss$/);
  });

  it("limits long descriptions at a word boundary", () => {
    const description = effectiveMetaDescription({
      excerpt: "",
      meta_description:
        "Wie lange eine Keramikversiegelung wirklich hält, wovon die Standzeit abhängt und was sie kostet – ehrlich erklärt von den Fahrzeugaufbereitern aus Horb am Neckar.",
    });

    expect(description.length).toBeLessThanOrEqual(155);
    expect(description).toMatch(/…$/);
    expect(description).not.toMatch(/\s…$/);
  });
});
