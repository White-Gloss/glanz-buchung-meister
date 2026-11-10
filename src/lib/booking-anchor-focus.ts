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

  // The same URL needs one scroll command: navigating again would make
  // the router issue a competing smooth scroll after its redundant reload.
  // Keep the existing section, CSS scroll margins, URL and entered form state.
  const section = document.getElementById("buchung");
  if (section && window.location.hash === "#buchung" && link.href === window.location.href) {
    event.preventDefault();
    section.scrollIntoView({ block: "start", behavior: "instant" });
  }
}
