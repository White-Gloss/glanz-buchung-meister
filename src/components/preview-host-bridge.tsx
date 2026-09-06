/**
 * Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
 * (and later receive registered routes). Noops when the app is not embedded.
 */

import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { resolveParentEmbedderOrigin } from "@/lib/preview-embedder-origin";

export function PreviewHostBridge() {
  const router = useRouter();

  useEffect(() => {
    const ancestorOrigins = window.location.ancestorOrigins;
    const parentOrigin = resolveParentEmbedderOrigin(
      window.parent === window,
      document.referrer,
      ancestorOrigins?.length ? ancestorOrigins[0] : null,
      window.location.hostname,
    );
    if (parentOrigin === null) return;

    // The bridge and its message validators are needed only inside an allowed preview.
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import("@/lib/preview-host-bridge")
      .then(({ collectRoutePathsFromTree, installPreviewHostBridge }) => {
        if (cancelled) return;
        dispose = installPreviewHostBridge({
          navigate: (path) => router.history.push(path),
          getRoutePaths: () => collectRoutePathsFromTree(router.routeTree),
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) console.warn("Preview host bridge could not be loaded.", error);
      });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [router]);

  return null;
}
