/**
 * Search terms from the ranking watchlist (as of 2026-10-17) and the page that owns each one.
 * Editorial mapping: one primary term per page, related terms used naturally in the copy.
 * This is not a ranking promise. Review and history: docs/seo-sichtbarkeit.md
 */
export type WatchedSearchTerm = {
  term: string;
  path: string;
  role: "primary" | "related";
};

export const watchedSearchTerms: WatchedSearchTerm[] = [
  { term: "fahrzeugaufbereitung horb am neckar", path: "/", role: "primary" },
  { term: "fahrzeugaufbereitung", path: "/", role: "related" },
  { term: "autoaufbereitung", path: "/leistungen/fahrzeugaufbereitung", role: "primary" },
  { term: "detailing", path: "/leistungen/fahrzeugaufbereitung", role: "related" },
  { term: "autopflege", path: "/leistungen", role: "primary" },
  { term: "kfz pflege", path: "/leistungen", role: "related" },
  { term: "auto polieren", path: "/leistungen/lackkorrektur", role: "primary" },
  { term: "lackaufbereitung", path: "/leistungen/lackkorrektur", role: "related" },
  { term: "keramikversiegelung auto", path: "/leistungen/keramikversiegelung", role: "primary" },
  { term: "lackversiegelung auto", path: "/leistungen/keramikversiegelung", role: "related" },
  { term: "innenraumreinigung auto", path: "/leistungen/innenraumreinigung", role: "primary" },
  { term: "auto innenreinigung", path: "/leistungen/innenraumreinigung", role: "related" },
  { term: "leasing rückläufer reinigen", path: "/leistungen/leasingrueckgabe", role: "primary" },
  { term: "fahrzeugaufbereitung reutlingen", path: "/abholservice/reutlingen", role: "primary" },
];
