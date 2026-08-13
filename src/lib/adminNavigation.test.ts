import { describe, expect, it } from "vitest";
import { adminNavigationGroups } from "./adminNavigation";

describe("adminNavigationGroups", () => {
  it("trennt das Tagesgeschäft von Dokumenten und Einstellungen", () => {
    expect(adminNavigationGroups.map((group) => group.label)).toEqual([
      "Tagesgeschäft",
      "Verwaltung",
    ]);
    expect(adminNavigationGroups.flatMap((group) => group.items.map((item) => item.label))).toEqual(
      expect.arrayContaining(["Buchungen", "Kundenakten", "Dokumente", "Einstellungen"]),
    );
  });
});
