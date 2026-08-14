import { describe, expect, it } from "vitest";
import { heroImageSources } from "./heroImage";

describe("heroImageSources", () => {
  it("serves a smaller mobile hero before the desktop source", () => {
    expect(heroImageSources.mobile.width).toBe(960);
    expect(heroImageSources.mobile.height).toBe(544);
    expect(heroImageSources.mobile.media).toBe("(max-width: 767px)");
    expect(heroImageSources.desktop.width).toBe(1920);
    expect(heroImageSources.mobile.src).not.toBe(heroImageSources.desktop.src);
  });
});
