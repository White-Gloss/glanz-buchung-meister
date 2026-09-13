# Bitrix-Werkstattablauf

Der eingebettete White-Gloss-Leitstand verbindet Bitrix-Aufträge über `/api/bitrix-workshop` mit der bestehenden Website-Buchung. Freigaben erfolgen ausdrücklich durch den Inhaber im Leitstand. Direkte CRM-Phasenwechsel und das Terminende lösen keine Rechnung aus.

- Die App prüft die Bitrix-Sitzung des Inhabers. Signierte Serveranfragen enthalten Buchungsversion und Vorgangskennung; die Website ordnet den vorhandenen, verifizierten Inhaber zu.
- Freigabe und Umbuchung reservieren das gesamte Intervall in der Website-Datenbank. Geänderte Angebote ohne bestätigte Kundenzustimmung bleiben offen. Stornierungen geben die Reservierung frei. Der vorhandene Bitrix-Kalenderjob hält die externe Kalender-ID fest; unklare Schreibvorgänge bleiben prüfpflichtig.
- Manuelle Bitrix-Sperren werden bei der Verfügbarkeitsanzeige und vor der Freigabe geprüft. Ganztägige Einträge werden einschließlich ihres letzten Tages und in Europe/Berlin berücksichtigt.
- Erst nach erfolgreicher Freigabe wird die Bestätigungs-PDF mit den übernommenen Leistungen in die dauerhafte Resend-Warteschlange aufgenommen. Sie ist keine Rechnung.
- Der manuelle Leistungsabschluss übernimmt finale Positionen, Betrag und Zahlungssituation. Die native App erstellt die Bitrix-Rechnung mit dauerhaftem Wiederholungsprotokoll und übergibt die getrennte Rechnungs-PDF an dieselbe Versandwarteschlange. Vollständige Barzahlung wird der Rechnung zugeordnet; Überweisung erhält sieben Kalendertage Zahlungsziel.
- Bitrix-geführte Aufträge werden nicht mehr durch den Lexware-Rechnungsworker verarbeitet. Bereits vorhandene fremde Rechnungen werden nicht neu erstellt.
- Versandfehler und Versandstatus stehen im zugehörigen Auftrag; PDF und Zahlungsdaten sind in der App dauerhaft gespeichert. Der KI-Agent bleibt beratend und kann keine Freigabe ersetzen.

Die öffentliche Prüfsignatur liegt im Repository; der private Schlüssel bleibt ausschließlich in der vorhandenen App-Serverkonfiguration. Migration 0018 wird wie die bestehenden Bitrix-Erweiterungen additiv zur Laufzeit eingerichtet und bleibt für Datenbank-Neuaufbauten versioniert.

Geprüft: 421 Repository-Tests, 10 Tests der nativen Rechnungserstellung, TypeScript, ESLint, Produktionsbuild und visuelle PDF-Beispiele. Kein Test hat eine echte Kundenrechnung erzeugt oder eine Kunden-E-Mail versendet.