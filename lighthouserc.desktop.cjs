const baseUrl = (process.env.LHCI_BASE_URL || "https://white-gloss.de").replace(/\/$/, "");

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      url: [
        `${baseUrl}/`,
        `${baseUrl}/preise`,
        `${baseUrl}/leistungen`,
        `${baseUrl}/abholservice/horb-am-neckar`,
      ],
      settings: {
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci/desktop",
    },
  },
};
