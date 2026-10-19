# Digitale Visitenkarte und QR-Code

Der QR-Code verweist dauerhaft auf `https://white-gloss.de/visitenkarte.html`.
Die dort sichtbaren Angaben können mit einer normalen, freigegebenen
IONOS-Veröffentlichung geändert werden. Der gedruckte Code bleibt unverändert,
solange dieser Pfad bestehen bleibt.

## Angaben ändern

- Allgemeine Betriebsangaben kommen aus `src/data/site.ts`.
- Karteneinstellungen stehen in `src/data/contact-card.ts`.
- `facebook` bleibt `null`, bis Lars die korrekte Profiladresse bestätigt.
  Ein bestätigter HTTPS-Link erscheint anschließend auf der Seite und in der vCard.
- Gestaltung und vCard-Format stehen in `scripts/contact-card-template.mjs`.

`npm run build` erzeugt `public/visitenkarte.html` und
`public/visitenkarte.vcf` aus denselben Werten. Diese Ausgabedateien nicht
von Hand pflegen. Eine Änderung der Zieladresse erfordert eine Weiterleitung
vom bisherigen Pfad; andernfalls funktionieren bereits gedruckte QR-Codes nicht mehr.

## Verhalten

Die Seite ist öffentlich, ohne Anmeldung und ohne erforderliches JavaScript
nutzbar. Sie lädt keine neuen Analyse- oder Social-Media-Skripte. Externe Dienste
werden erst über die jeweiligen Links geöffnet. „Kontakt speichern“ lädt eine
vCard 3.0 mit den aktuell veröffentlichten Kontaktdaten herunter.

Bereits in einem Telefon gespeicherte Kontakte aktualisieren sich nicht
automatisch. Nach einer Änderung muss die neue vCard erneut übernommen werden.

## Prüfen und veröffentlichen

Offline-Erzeugung: `node scripts/write-contact-card.mjs`.
Es gelten weiterhin die vorhandenen CI-Prüfungen und ausschließlich der
bestehende IONOS-Veröffentlichungsweg. Keinen lokalen Webserver starten.
Vor dem Druck muss die tatsächliche öffentliche URL die erwartete Karte
und der Download die aktuelle vCard liefern. Mobil- und Desktopansicht
auf der veröffentlichten Seite prüfen.
