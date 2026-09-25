import { vehicleClasses, type ServicePage } from "@/data/site";

export function ServicePriceNote({ service }: { service: ServicePage }) {
  if (!service.fromPrice || service.pendingApproval) return null;
  return <p className="mt-3 text-sm text-muted">
    {service.slug === "lederreparatur" ? "Orientierungspreise je angegebener Reparaturstelle bzw. Fläche für die Kompaktklasse. " : "Einstiegspreis für die Kompaktklasse. "}
    Der Anfragerechner berücksichtigt {vehicleClasses.filter((c) => c.factor !== 1).map((c) => `${c.label}: Faktor ${c.factor.toLocaleString("de-DE")}`).join("; ")} auf Paket und Zusatzleistungen, auch auf ausgewählte Reparaturen. Die Abholung wird separat berechnet. Umfang und verbindlichen Preis stimmen wir nach Prüfung vor Beginn ab.
  </p>;
}
