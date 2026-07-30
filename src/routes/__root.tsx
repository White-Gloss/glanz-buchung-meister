import {
  Outlet,
  Link,
  createRootRoute,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { listServicePrices } from "@/lib/pricing.functions";
import { applyPriceOverrides } from "@/lib/servicesConfig";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Seite nicht gefunden</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Die gesuchte Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Diese Seite konnte nicht geladen werden
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Es ist ein Fehler aufgetreten. Bitte laden Sie die Seite neu oder wechseln Sie zur
          Startseite.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Erneut versuchen
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Zur Startseite
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fahrzeugaufbereitung Horb am Neckar | White Gloss" },
      {
        name: "description",
        content:
          "Fahrzeugaufbereitung in Horb am Neckar: Innenreinigung, Lackkorrektur und Keramikversiegelung mit Hol- und Bringservice. Jetzt Termin anfragen.",
      },
      { name: "author", content: "White Gloss Detailing" },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:title", content: "Fahrzeugaufbereitung Horb am Neckar | White Gloss" },
      {
        property: "og:description",
        content:
          "Innenreinigung, Lackkorrektur und Keramikversiegelung mit Hol- und Bringservice rund um Horb am Neckar.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "White Gloss Detailing" },
      { property: "og:locale", content: "de_DE" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Fahrzeugaufbereitung Horb am Neckar | White Gloss" },
      {
        name: "twitter:description",
        content:
          "Innenreinigung, Lackkorrektur und Keramikversiegelung mit Hol- und Bringservice rund um Horb am Neckar.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),

  loader: () => listServicePrices(),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // Zentral gepflegte Preise anwenden, bevor Kindrouten rendern (Server + Client)
  applyPriceOverrides(Route.useLoaderData());

  return (
    // Required: nested routes render here. Removing <Outlet /> breaks all child routes.
    <Outlet />
  );
}
