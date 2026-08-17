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

  // Ohne JavaScript gibt es keinen IntersectionObserver, der die Schaltfläche
  // wieder einblenden könnte. Sie muss deshalb sichtbar ausgeliefert werden
  // und darf erst im Browser ausgeblendet werden — nie umgekehrt.
  it("wird sichtbar ausgeliefert und ist bedienbar", () => {
    const html = renderToStaticMarkup(createElement(WhatsAppFloat));

    expect(html).toContain("opacity-100");
    expect(html).not.toContain("opacity-0");
    expect(html).not.toContain("pointer-events-none");
    expect(html).toContain('aria-hidden="false"');
  });
});
