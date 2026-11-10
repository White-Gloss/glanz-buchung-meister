# Anfrage, Fotofehler und E-Mail – 09.11.2026

Entwicklungsstand auf Basis `db305e3`; Veröffentlichung separat nachzuweisen.

## Änderung

- Ein Anfrageereignis legt weiter genau eine Kunden-Eingangsmail ohne PDF an. Ist die Kundenadresse zugleich die Betriebsadresse, entfällt die zusätzliche Betreiber-E-Mail; andere Betreiberkanäle und reine Betreiberereignisse bleiben erhalten.
- Die Eingangsmail verwendet Sie-Anrede, kurze Absätze und Lars als Absender im Text. Sie erklärt Prüfung, gemeinsames Angebot mit Termin, freiwillige Einrichtung des Kundenbereichs sowie das Nachreichen von Fotos.
- Bei einem Foto-Fehler bleibt die bereits gespeicherte Anfrage maßgeblich. „Neue Anfrage beginnen“ wurde entfernt. „Übrige Fotos erneut senden“ lädt nur verbleibende Dateien hoch; „Fotos später nachreichen“ öffnet die Bestätigungsseite derselben Anfrage.
- Der Wiederholungsschlüssel bleibt bei Fehlern erhalten. Erst die erfolgreiche Navigation zur Bestätigungsseite beendet den Vorgang. Ein Fehler beim Öffnen dieser Seite wird nicht mehr als Foto-Uploadfehler ausgegeben.
- Die bereits gespeicherte Bewertungs-Einwilligung kann in diesem Zwischenzustand nicht mehr scheinbar geändert werden.

## Zugehörige Panel-Änderung

Das Panel verschickt beim Import oder Anlegen von Kunden/Aufträgen keine zusätzliche automatische Kontoeinrichtungsmail mehr. E-Mail-Codes werden vom Kunden ausdrücklich angefordert. Angebote, gemeinsame Unterschrift, Auftragsbestätigung, dokumentbezogene Protokollmails, 72-Stunden-Erinnerung, Rechnung und einwilligungsabhängige Bewertungsmail bleiben fachlich erhalten.

## Nachweis und Grenze

Der bisherige Doppelausgang an dieselbe Adresse wurde zuerst mit einem fehlschlagenden Datenbanktest reproduziert. Nach dem Fix bestanden 13 fokussierte Tests. Zwei zusätzliche echte Browserfälle auf dem bestehenden isolierten GitHub-Runner prüfen Speicherfehler, Teilupload-Wiederholung, Überspringen und Doppelklicks gegen echte Formular-/RPC-Logik und isolierte Anbieter. Exakte finale Ergebnisse stehen im PR.

Keine echten Anfragen oder E-Mails als Test. Aus dem Screenshot allein ist die zugrunde liegende Upload-Transportstörung nicht bestimmbar. Dieser Fix verhindert neue Anfragen und zusätzliche E-Mails bei der Fehlerbehandlung; eine erfolgreiche Übertragung echter Kundendateien wird damit nicht behauptet.
