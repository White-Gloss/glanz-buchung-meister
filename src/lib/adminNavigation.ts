export type AdminNavigationItem = {
  label: string;
  description: string;
  to: "/admin" | "/admin/kunden" | "/admin/unterlagen" | "/admin/einstellungen" | "/admin/erpnext";
};

export type AdminNavigationGroup = {
  label: "Tagesgeschäft" | "Verwaltung";
  items: AdminNavigationItem[];
};

export const adminNavigationGroups: AdminNavigationGroup[] = [
  {
    label: "Tagesgeschäft",
    items: [
      {
        label: "Buchungen",
        description: "Anfragen, Termine, Preise und Status bearbeiten",
        to: "/admin",
      },
      {
        label: "Kundenakten",
        description: "Kontaktdaten, Historie und interne Notizen",
        to: "/admin/kunden",
      },
      {
        label: "Dokumente",
        description: "Angebote, Rechnungen und Erinnerungen bearbeiten",
        to: "/admin/unterlagen",
      },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      {
        label: "ERPNext",
        description: "Verbindung und Berechtigungen von WHITE GLOSS OS prüfen",
        to: "/admin/erpnext",
      },
      {
        label: "Einstellungen",
        description: "Leistungen, Inhalte, Kommunikation und Abläufe",
        to: "/admin/einstellungen",
      },
    ],
  },
];
