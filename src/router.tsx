import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { createScriptNonce } from "../server/security-headers";
import { NotFoundComponent } from "@/components/not-found";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

const prepareRequestNonce = createIsomorphicFn()
  .server(() => {
    if (!import.meta.env.PROD) return undefined;
    return createScriptNonce();
  })
  .client(() => undefined);

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: NotFoundComponent,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    // Start, React's stream renderer and client hydration share this nonce.
    ssr: { nonce: prepareRequestNonce() },
  });
}
