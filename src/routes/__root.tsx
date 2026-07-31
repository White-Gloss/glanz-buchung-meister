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

function NotFoundComponent() {
  return (
    <>
      <title>Seite nicht gefunden | White Gloss Detailing</title>
      <meta name="robots" content="noindex,nofollow" />
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <p className="eyebrow">Fehler 404</p>
          <h1 className="display-page mt-3 text-foreground">Seite nicht gefunden</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Die gesuchte Seite existiert nicht oder wurde verschoben.
          </p>
          <div className="mt-7">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Zur Startseite
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <>
      <title>Technischer Fehler | White Gloss Detailing</title>
      <meta name="robots" content="noindex,nofollow" />
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <p className="eyebrow">Technischer Hinweis</p>
          <h1 className="display-page mt-3 text-foreground">
            Diese Seite konnte nicht geladen werden
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Es ist ein Fehler aufgetreten. Bitte laden Sie die Seite neu oder wechseln Sie zur
            Startseite.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Erneut versuchen
            </button>
            <a
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-input bg-background px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Zur Startseite
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Fahrzeugaufbereitung Horb am Neckar | White Gloss" },
      {
        name: "description",
        content:
          "Fahrzeugaufbereitung in Horb am Neckar: Innenreinigung, Lackkorrektur und Keramikversiegelung mit Hol- und Bringservice. Jetzt Termin anfragen.",
      },
      { name: "author", content: "White Gloss Detailing" },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { name: "theme-color", content: "#080a0d" },
      { name: "color-scheme", content: "dark" },
      { name: "format-detection", content: "telephone=no" },
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
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className="dark">
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
  return <Outlet />;
}
