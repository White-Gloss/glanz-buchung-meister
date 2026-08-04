import {
  Outlet,
  Link,
  createRootRoute,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { listServicePrices } from "../lib/pricing.functions";
import { applyPriceOverrides, type ServicePriceRow } from "../lib/servicesConfig";
import { CookieConsentBanner } from "../components/CookieConsent";

function NotFoundComponent() {
  return (
    <>
      <title>Seite nicht gefunden | White Gloss Detailing</title>
      <meta name="robots" content="noindex,nofollow" />
      <main
        id="main-content"
        className="flex min-h-dvh items-center justify-center bg-background px-4"
      >
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
      </main>
    </>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <>
      <title>Technischer Fehler | White Gloss Detailing</title>
      <meta name="robots" content="noindex,nofollow" />
      <main
        id="main-content"
        className="flex min-h-dvh items-center justify-center bg-background px-4"
      >
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
      </main>
    </>
  );
}

export const Route = createRootRoute({
  /**
   * Preise einmal pro Aufruf laden und auf die zentrale Konfiguration anwenden.
   * Dadurch zeigen Startseite, Preisseite, Leistungsseiten und Buchungstool
   * dieselben Werte – vorher galten die DB-Preise nur im Buchungsassistenten.
   * Fehler bleiben ohne Folgen: dann greifen die Standardwerte aus dem Code.
   */
  loader: async (): Promise<{ prices: ServicePriceRow[] }> => {
    try {
      const prices = await listServicePrices();
      // Bereits hier anwenden, damit auch die head()-Funktionen der
      // Unterseiten (Meta-Beschreibungen mit Preisangaben) korrekt sind.
      applyPriceOverrides(prices);
      return { prices };
    } catch {
      return { prices: [] };
    }
  },
  // Preise ändern sich selten – eine Minute Cache spart Anfragen bei jeder Navigation.
  staleTime: 60_000,

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
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { rel: "icon", href: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { rel: "icon", href: "/favicon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
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
        {/* WCAG 2.4.1 "Bypass Blocks": erster Tabstopp überspringt Kopfnavigation. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Zum Inhalt springen
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { prices } = Route.useLoaderData();
  // Muss vor dem Rendern der Unterseiten passieren, damit Server- und
  // Client-Ausgabe identisch sind (keine Hydration-Abweichung).
  applyPriceOverrides(prices);
  return (
    <>
      <Outlet />
      <CookieConsentBanner />
    </>
  );
}
