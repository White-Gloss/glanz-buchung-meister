# White-Gloss: Bitrix-KI-Agent und verbindlicher Zielablauf

Stand: 13.09.2026, PR #192 mit dem veröffentlichten Stand aus PR #191, #193 und #194 zusammengeführt. Der bereits veröffentlichte KI-Agent bleibt die einzige Agenten-Implementierung. Die zusätzlichen Änderungen in diesem PR betreffen die Buchungssynchronisation; sie sind **keine abgeschlossene Migration des Rechnungsbetriebs zu Bitrix24**.

Agent, Zugang, Schema und Live-Prüfung sind in [bitrix-agent-workflow.md](bitrix-agent-workflow.md) dokumentiert.

## Implementiert

- Agent unter `/admin/bitrix` und `/admin/automatisierung`, Modell ausschließlich `bitrix/bitrixgpt-5.5` über `https://vibecode.bitrix24.com/v1/chat/completions`.
- Anmeldung und Betriebsberechtigung für alle Funktionen, Schlüsselverwaltung nur durch den Inhaber. Schlüssel werden niemals an den Browser zurückgegeben oder in den Quellcode geschrieben.
- Separate Konfiguration `VIBE_AI_API_KEY` oder den separaten Dialog „KI-Zugang“. Ein persönlicher Schlüssel aus der bestehenden CRM-Konfiguration kann wiederverwendet werden. REST-Webhook-URLs werden niemals als AI-Router-Schlüssel versendet. Ein eigener KI-Schlüssel überschreibt die CRM-Verbindung nicht.
- Der veröffentlichte Agent prüft einen ausgewählten Auftrag mit Buchungsversion und optional bis zu vier zugeordneten Bildern. Er übermittelt relevante Buchungsfelder und geladene Bilddaten, keine signierten Foto-URLs oder Schlüssel. Die allgemeine Ablaufhilfe erhält eine begrenzte Übersicht offener Buchungen. Umfang und Grenzen werden im Agenten erklärt.
- Antworten sind als interne KI-Entwürfe markiert. Keine Tool-Ausführung, keine Buchungs- oder Zahlungsmutation und kein Dokumentenversand aus Modellantworten. Ein Prompt ist nicht die Sicherheitsgrenze: Es gibt im KI-Ausführungspfad keine Mutationswerkzeuge.
- Persistente Anfragekennungen, serverseitiges Limit, Zeitlimit und sichtbare Fehler. Identische Wiederholungen liefern den gespeicherten Ausgang. Eine bewusst neu gestartete Analyse erhält eine neue Kennung und verwendet den ausgewählten Buchungsstand.
- Der alte Grok-Interpreter bleibt entfernt. KI-Anfragen laufen ausschließlich über den veröffentlichten Agenten; die alten Befehlsschnittstellen aktivieren keinen zweiten KI-Weg. Der Kurzbefehl `rechnung` zeigt nur den Status, statt einen zusätzlichen Rechnungsentwurf anzulegen.
- Erweiterte manuelle Zeitplanung/Leistungsabschluss stellen nun auch einen Bitrix-Sync in die Queue. Frühere Kundenannahmen bestätigen kein geändertes Angebot automatisch.
- Bitrix-Kalender übernimmt gespeicherte Start-/Endzeitpunkte, aktualisiert bestehende Termine und entfernt den Eintrag bei Stornierung, Ablehnung oder Rückkehr zur offenen Anfrage. Für historische Datensätze ohne Arbeitszeitraum bleibt die bisherige Paketdauer als Kompatibilität erhalten; dies ersetzt keine manuelle Dauerfreigabe.
- Positionssummen entsprechen einem gespeicherten vereinbarten Preis. Fehler bei Positionen/Fotos sind sichtbar. Ein unsicherer Kontakt-/Deal-/Kalender-POST geht auf `review`, statt denselben Datensatz erneut anzulegen. REST-POSTs werden nicht mehr nach beliebigen Fehlern ohne benutzerdefinierte Felder wiederholt. Der Worker erneuert seine Sperre vor jedem externen Aufruf.

## Verbindliche Schritte und noch offene Bitrix-Umstellung

| Schritt | Freigabe / Wirkung | Noch erforderlich für Betrieb vollständig in Bitrix24 |
| --- | --- | --- |
| 1. Anfrage | Website speichert Anfrage und ordnet Fotos zu; Preis vorläufig, keine Zusage | Fotoübertragung und Feldzuordnung im tatsächlichen Portal prüfen |
| 2. Eingang | Unverbindliche E-Mail ohne PDF; Text entspricht Lars' Vorgabe | Live-Versandstatus prüfen, ohne echte Kunden für Tests zu kontaktieren |
| 3. Prüfung | Lars prüft Leistungen/Fotos und legt Preis sowie vollständigen Zeitraum fest; erforderliche Annahme des aktuellen Angebots explizit | Authentifizierter Bitrix-Bedienweg zur bestehenden Reservierungslogik; alternative Angebote und revisionsgebundene Kundenannahme vollständig abbilden |
| 4. Reservierung | Ganze Zeitspanne für die Kapazität unter Datenbanksperre prüfen; erst anschließend bestätigen | Rückkanal für direkt in Bitrix angelegte/geänderte Termine und manuelle Sperrzeiten; Ganztag/mehrere Tage/Mitternacht im Live-Portal und auf der Website abnehmen |
| 5. Bestätigung | White-Gloss-PDF nach manueller Freigabe und Reservierung; keine Rechnung | Bisheriger Bestätigungs-PDF-Job liegt im Zoho-Worker. Exklusiven Bitrix-Dokumentenweg implementieren und Versandfreigabe anbinden |
| 6. Abschluss | Ausschließlich manueller tatsächlicher Leistungsabschluss mit finalem Betrag und Zahlungswahl | Native Bitrix-Abschlussaktion mit Inhaberprüfung, Versionsprüfung und dokumentiertem Zahlungsnachweis; alte direkte Statusaktionen vereinheitlichen |
| 7. Rechnung | Separates Dokument. Bar: Betrag/Datum und Zuordnung, bezahlt nur bei Vollzahlung, keine Mahnung. Überweisung: IBAN, Verwendungszweck, Rechnungsdatum + 7 Kalendertage, bis Eingang offen | Bisher ist Lexware im Code als Rechnungssystem festgelegt. Bitrix-Rechnung, Zahlungsbuchung, PDF/E-Mail, offene Posten und Statusrückmeldung implementieren und erst danach exklusiv umschalten. Keine parallele Rechnungserzeugung |

Der Agent kennt diese Anforderungen und benennt fehlende Nachweise. Seine Antwort ist kein Nachweis für Portal-Konfiguration, Bildprüfung, freie Kapazität, PDF-Versand oder Zahlungseingang.

## Bereitstellung und Verifikation

1. Keine zweite Agenten-Migration ausführen: Die noch nicht veröffentlichte `0017_vibe_ai.sql` und ihre parallelen Agenten-Dateien wurden bei der Konfliktauflösung durch die bereits veröffentlichte `0017_bitrix_agent.sql` und deren Implementierung ersetzt. Der bestehende Release-Vertrag und die geprüfte Schemaanlage bleiben erhalten. Nicht auf das getrennte historische Supabase-UUID-Schema anwenden.
2. Geprüfte Version über den bestehenden IONOS-Releaseweg bereitstellen. Ein grüner Build oder PR allein bedeutet noch keinen Live-Deploy.
3. Im Inhaberkonto unter Bitrix24 den KI-Schlüssel speichern oder `VIBE_AI_API_KEY` serverseitig setzen. Kein `VITE_`-Präfix, kein Schlüssel im Git-Repository. Das in dieser Sitzung verwendete Schlüsselmaterial ist nicht Teil des PRs.
4. Einen internen KI-Aufruf gegen das reale Modell prüfen. Für Tests keine Kunden-E-Mails senden, keine echten Rechnungen erstellen oder Zahlungen als erhalten markieren.
5. Bei `bitrix_write_uncertain`: vor erneutem Anlegen den vorhandenen externen Datensatz ermitteln und dessen ID korrekt am Auftrag/Queue zuordnen. Ein bloßes „Erneut prüfen“ löscht die Schutzmarkierung absichtlich nicht. Fehlende benutzerdefinierte CRM-Felder korrekt einrichten; Fehler nicht durch stilles Weglassen verdecken.

Der Router wurde mit einem nicht personenbezogenen Testaufruf erfolgreich geprüft. Die API-Schlüsselprüfung meldete AI-Router-Zugriff; ein zusätzlicher verwalteter Agent/Server war wegen `TRIAL_PORTAL_LIMIT` nicht verfügbar. Deshalb läuft die Integration auf dem vorhandenen Admin-Server.

## Quellen

- [VibeCode AI Router](https://vibecode.bitrix24.com/docs/ai)
- [Kalenderereignisse](https://vibecode.bitrix24.com/docs/entities/calendar-events)
- [API-Schlüssel-Discovery](https://vibecode.bitrix24.com/v1/me)
