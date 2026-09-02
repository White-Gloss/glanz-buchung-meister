import { createRouter } from "@tanstack/react-router";
import { NotFoundComponent } from "@/components/not-found";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: NotFoundComponent,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });
}
