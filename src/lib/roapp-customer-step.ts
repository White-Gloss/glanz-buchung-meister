/** A status label alone does not prove a signature or a payment. */
export function roappCustomerStep(status: string, fixed: boolean) {
  if (/abgelehnt|storniert/i.test(status))
    return {
      text: "Diese Anfrage wird nicht weiterbearbeitet. Für Änderungen oder einen neuen Termin kontaktieren Sie uns bitte.",
      linkLabel: null,
    };
  if (!fixed)
    return {
      text: "Wir prüfen Ihre Angaben und Fahrzeugfotos. Preis und Termin sind noch nicht verbindlich bestätigt. Bei Rückfragen melden wir uns bei Ihnen.",
      linkLabel: null,
    };
  if (status === "Fixpreis bestätigt")
    return {
      text: "Unsere Preisprüfung ist abgeschlossen. Prüfen Sie jetzt die Leistungen, den Fixpreis und den Termin im Auftrag. Dort können Sie den Auftrag annehmen und selbst unterschreiben.",
      linkLabel: "Auftrag prüfen und unterschreiben",
    };
  if (status === "Akzeptiert")
    return {
      text: "Ihr Auftrag ist als angenommen vermerkt. Die vereinbarten Angaben und eine gegebenenfalls abgegebene Unterschrift finden Sie im Auftrag. Bei Änderungswünschen kontaktieren Sie uns bitte.",
      linkLabel: "Auftrag ansehen",
    };
  if (status === "In Arbeit")
    return {
      text: "Ihr Fahrzeug wird bearbeitet. Wir informieren Sie, sobald die vereinbarten Arbeiten abgeschlossen sind.",
      linkLabel: "Auftrag ansehen",
    };
  if (
    [
      "Erledigt",
      "Warten auf Abholung",
      "Lieferung",
      "Geschlossen",
      "Archiviert",
      "In Rechnung gestellt",
    ].includes(status)
  )
    return {
      text: "Den aktuellen Stand sehen Sie im Auftrag. Abholung oder Rückgabe stimmen wir mit Ihnen ab. Die Rechnung versenden wir separat nach erbrachter Leistung; dieser Status ist kein Zahlungsnachweis.",
      linkLabel: "Auftrag ansehen",
    };
  return {
    text: "Den aktuellen Bearbeitungsstand und die vereinbarten Angaben finden Sie im Auftrag. Bei Rückfragen kontaktieren Sie uns bitte.",
    linkLabel: "Auftrag ansehen",
  };
}
