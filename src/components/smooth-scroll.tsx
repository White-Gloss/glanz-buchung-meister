import { useEffect } from "react";
import { browserSmoothScrollEnv, controlSmoothScroll } from "@/lib/smooth-scroll";

/** Lenis für die öffentliche Website; Admin und Login bleiben nativ. */
export function SmoothScroll() {
  useEffect(() => controlSmoothScroll(browserSmoothScrollEnv()), []);
  return null;
}
