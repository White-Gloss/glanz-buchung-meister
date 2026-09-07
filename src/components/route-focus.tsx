import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/** Put keyboard and screen-reader focus into the newly rendered page. */
export function RouteFocus() {
  const router = useRouter();
  useEffect(() => {
    let frame = 0;
    const unsubscribe = router.subscribe("onRendered", (event) => {
      if (!event.fromLocation || !event.pathChanged || event.toLocation.hash) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const main = document.getElementById("main-content");
        if (!main) return;
        main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      });
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [router]);
  return null;
}
