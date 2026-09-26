# Isolierte Ablaufprüfung

Diese Skripte sind ausschließlich lokale Prüfwerkzeuge. Sie werden von der Anwendung nicht importiert. Der Testserver nutzt eine frische PGlite-Datenbank im Arbeitsspeicher, setzt synthetische Zugangsdaten und Empfänger und fängt Resend/Storage lokal ab. Andere serverseitige Fetch-Ziele werden blockiert. Er bindet nur 127.0.0.1; es entstehen keine Produktionsbuchungen oder echten Nachrichten.

1. Abhängigkeiten installieren und mit `npm run build` den Node-Produktionsbuild erstellen. Der Build führt keine Datenbankmigration aus. Ohne Vercel-Laufzeitflag ist Node der Standard; `NITRO_PRESET` kann das Ziel ausdrücklich überschreiben.
2. `npm run qa:serve` starten. Ports 8082 und 8099 müssen frei sein.
3. In einem zweiten Terminal im Repository `npm run test:flows` ausführen. Die Tests prüfen zuerst die Identität des isolierten Servers und verändern ausschließlich dessen synthetische Daten.
4. Den Testserver mit Strg+C beenden. Vor einer vollständigen Wiederholung frisch starten; die Datenbank wird zurückgesetzt.

Die Ergebnisse liegen im ignorierten Verzeichnis `.qa-output/`. `npm test` enthält die unabhängigen Regressionstests. `FRONTEND_BASE_URL=http://127.0.0.1:8082 npm run test:frontend` prüft zusätzlich die SSR-Seiten; Umgebungsvariablen passend zur verwendeten Shell setzen.

Die Ablaufprüfung umfasst Speicherung, Referenz/Terminzusage, Posteingang, abgefangenen Mailversand, Datei-Metadaten und Storage, unberechtigte Uploads, ungültige zweite Dateien, Ausfälle und Stapelbereinigung sowie Veröffentlichen/Zurückziehen eines CMS-Artikels und den Sitemap-Fallback. Sie ersetzt keine Prüfung der echten Providerzustellung nach einem freigegebenen Release.

Automatisch übernimmt `npm run test:release` die Schritte 2–4 einschließlich
SSR-Prüfung, Portkollisionskontrolle, Identitätsprüfung und Prozessbereinigung.
Dieser Befehl läuft auch in CI nach dem Build. Der Testserver setzt ausdrücklich
`ALLOW_LOCAL_PGLITE=1` und bindet ausschließlich an Loopback; diese Einstellung
gehört nicht in den öffentlichen Produktionsbetrieb.
