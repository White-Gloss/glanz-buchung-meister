export const adminNav = [
  { to: "/admin", label: "Buchungen", match: "exact" as const },
  { to: "/admin/posteingang", label: "Posteingang", match: "prefix" as const },
  { to: "/admin/kalender", label: "Kalender", match: "prefix" as const },
  { to: "/admin/automatisierung", label: "Leitstand", match: "prefix" as const },
  { to: "/admin/kunden", label: "Kundenakten", match: "prefix" as const },
  { to: "/admin/unterlagen", label: "Dokumente", match: "prefix" as const },
  { to: "/admin/erpnext", label: "Buchhaltung", match: "prefix" as const },
  { to: "/admin/einstellungen", label: "Einstellungen", match: "prefix" as const },
] as const;
