import type { MouseEvent } from "react";

/** Add destination focus without taking over the router's existing anchor link. */
export function focusBookingHeading(event: MouseEvent<HTMLAnchorElement>) {
  const link = event.currentTarget;
  if (
    event.defaultPrevented || event.button !== 0 ||
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
    (link.target && link.target !== "_self") || link.hasAttribute("download")
  ) return;

  const heading = document.getElementById("buchung-heading");
  if (!heading) return;
  heading.focus({ preventScroll: true });

  // A repeated same-fragment click still returns to the form. Keep the same
  // section and CSS scroll margins as the router, without changing form state.
  if (window.location.hash === "#buchung") {
    document.getElementById("buchung")?.scrollIntoView({ block: "start" });
  }
}
