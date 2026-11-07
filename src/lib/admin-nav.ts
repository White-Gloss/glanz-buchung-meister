export const adminNav = [
  { to: "/admin/bitrix", label: "Bitrix24", match: "prefix" as const },
  { to: "/admin/studio", label: "Website Studio", match: "prefix" as const },
  { to: "/admin/einstellungen", label: "Website", match: "prefix" as const },
] as const;
