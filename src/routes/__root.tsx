import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { NotFoundComponent } from "@/components/not-found";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Shell } from "@/components/site-chrome";
import { site } from "@/data/site";
import { googleSiteVerificationMeta } from "@/lib/googleSiteVerification";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  notFoundComponent: NotFoundComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: `Fahrzeugaufbereitung ${site.city} | ${site.name}` },
      {
        name: "description",
        content:
          "Premium-Fahrzeugaufbereitung in Horb am Neckar: Innenreinigung, Lackkorrektur, Keramikversiegelung und Hol- und Bringservice. Termin anfragen.",
      },
      { name: "theme-color", content: "#000000" },
      { name: "robots", content: "index,follow,max-image-preview:large" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => {
    return (
      <html lang="de" className="antialiased" suppressHydrationWarning>
        <head>
          {/*
            Google Tag (gtag.js) für Ads/GA4 wird bewusst NICHT hier
            eingebunden. Er lädt erst nach erteilter Cookie-Einwilligung über
            `loadGoogleTag()` aus `lib/googleTag.ts`, ausgelöst vom
            Cookie-Banner (`components/consent-banner.tsx`). Ein
            bedingungsloses `<script>` hier würde Tracking vor jeder
            Einwilligung starten (§ 25 TDDDG, Art. 6 Abs. 1 lit. a DSGVO).
          */}
          {/*
            Bestätigungscodes der Google Search Console — hier und nicht in
            head(), weil die dortige Meta-Liste nach `name` dedupliziert wird
            und von mehreren Einträgen gleichen Namens nur der letzte
            überlebt. Beim Domainumzug sind zwei Properties gleichzeitig zu
            bestätigen; der stillschweigend verworfene Code wäre als Fehler
            praktisch nicht zu erkennen. Ohne Code entsteht kein Tag: Ein
            leeres content-Attribut lehnt Google als ungültig ab.
            Einzelheiten in lib/googleSiteVerification.ts.
          */}
          {googleSiteVerificationMeta(import.meta.env.VITE_GOOGLE_SITE_VERIFICATION).map((tag) => (
            <meta key={tag.content} name={tag.name} content={tag.content} />
          ))}
          <HeadContent />
        </head>
        <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <Shell />
        </AuthProvider>
        <Scripts />
      </body>
      </html>
    );
  },
});
