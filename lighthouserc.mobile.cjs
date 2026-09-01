const baseUrl = (process.env.LHCI_BASE_URL || "https://white-gloss.de").replace(/\/$/, "");

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      url: [`${baseUrl}/`, `${baseUrl}/preise`, `${baseUrl}/leistungen`, `${baseUrl}/abholservice`],
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        // Gate the individual best-practices audits, not the opaque category
        // score: production-only scripts (platform branding/injector, tag
        // manager) log deprecations and console errors that would otherwise
        // collapse the whole category below the threshold.
        "is-on-https": "error",
        "redirects-http": "error",
        "viewport": "error",
        "doctype": "error",
        "charset": "error",
        "image-size-responsive": "error",
        "image-aspect-ratio": "error",
        "geolocation-on-start": "error",
        "notification-on-start": "error",
        "paste-preventing-inputs": "error",
        "deprecations": "warn",
        "third-party-cookies": "warn",
        "errors-in-console": "warn",
        "inspector-issues": "warn",
        "categories:seo": ["error", { minScore: 0.95 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci/mobile",
    },
  },
};
