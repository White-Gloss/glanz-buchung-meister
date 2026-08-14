import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WhatsAppFloat } from "./WhatsAppFloat";

describe("WhatsAppFloat", () => {
  it("uses dark foreground text on WhatsApp green for sufficient contrast", () => {
    const html = renderToStaticMarkup(createElement(WhatsAppFloat));

    expect(html).toContain("text-[#071a0f]");
    expect(html).not.toContain("text-white");
  });
});
