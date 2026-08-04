/**
 * Übersetzt technische Backend-/Konfigurationsfehler in verständliche
 * deutsche Meldungen inklusive Hinweis, welche Secrets fehlen.
 */
import { getSupabaseConfigStatus } from "@/lib/supabaseConfig";

export type BackendErrorInfo = {
  title: string;
  description: string;
  /** Namen fehlender Konfigurationswerte (Secrets), falls erkennbar */
  missing: string[];
  /** Konkrete Handlungsanweisung für Betreiber:innen */
  hint?: string;
  /** Technischer Originaltext (nur als Detail anzeigen) */
  technical?: string;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function diagnoseBackendError(error: unknown): BackendErrorInfo {
  const message = messageOf(error);
  const technical = message || undefined;

  // Fehlende Supabase-Client-Variablen (Build-Zeit eingebettet)
  if (message.includes("Missing Supabase environment variable")) {
    const status = getSupabaseConfigStatus();
    const missing = status.missing.length
      ? status.missing
      : ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"];
    return {
      title: "Backend nicht verbunden",
      description:
        "Die Zugangsdaten zum Backend fehlen in dieser Version der Website, deshalb können keine Daten geladen werden.",
      missing,
      hint: "Bitte die Seite erneut veröffentlichen, damit die aktuellen Einstellungen übernommen werden.",
      technical,
    };
  }

  // Fehlende Datenbank-Verbindung im Server-Runtime
  if (
    message.includes("SUPABASE_DB_URL") ||
    message.includes("DATABASE_URL") ||
    message.includes("Datenbankverbindung nicht konfiguriert")
  ) {
    return {
      title: "Datenbank nicht erreichbar",
      description:
        "Die Verbindung zur Datenbank ist nicht konfiguriert, deshalb konnte die Aktion nicht ausgeführt werden.",
      missing: ["SUPABASE_DB_URL"],
      hint: "Bitte das Backend in den Projekteinstellungen verbinden und die Seite erneut veröffentlichen.",
      technical,
    };
  }

  // Nicht angemeldet / keine Berechtigung
  if (
    message.includes("Unauthorized") ||
    message.includes("401") ||
    message.toLowerCase().includes("nicht angemeldet")
  ) {
    return {
      title: "Anmeldung erforderlich",
      description:
        "Ihre Sitzung ist abgelaufen oder Sie sind nicht angemeldet. Bitte melden Sie sich erneut an.",
      missing: [],
      technical,
    };
  }

  if (message.includes("Administrator")) {
    return {
      title: "Kein Administrator-Zugriff",
      description:
        "Ihr Konto besitzt keine Admin-Rolle. Bitte lassen Sie sich von einem bestehenden Administrator freischalten.",
      missing: [],
      technical,
    };
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      title: "Keine Internetverbindung",
      description: "Bitte prüfen Sie Ihr Netzwerk und versuchen Sie es anschließend erneut.",
      missing: [],
      technical,
    };
  }

  return {
    title: "Aktion fehlgeschlagen",
    description:
      message ||
      "Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuchen Sie es in einem Moment erneut.",
    missing: [],
    technical,
  };
}
