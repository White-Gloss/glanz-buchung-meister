# Website-Verbesserungen – Prüfstand 15. September 2026

## Ausgangslage und Umfang

Bearbeitet wurde ein frischer Checkout von `White-Gloss/glanz-buchung-meister`, Ausgangscommit `4d7ffb4d85e399729bb422408acd3a135d96104b`, auf `codex/website-anfrage-seo-bewertungen`. Vorhandene andere Arbeitskopien mit nicht eingecheckten Änderungen wurden nicht verändert. Die öffentliche Website wurde zusätzlich im Browser geprüft; ihre genaue Deployment-Commitkennung war nicht zuverlässig öffentlich feststellbar. Repository-HEAD ist deshalb kein Beleg für den Live-Stand.

| Befund | Umsetzung |
| --- | --- |
| Innenraumreinigung führte ohne Paketübergabe zur Standardauswahl für 349 € | Gemeinsame validierte Übergabe: Innenraum → Basis, Lackkorrektur → Reinigung & Politur, Keramik → Keramikschutz. Individuelle Leistungen bleiben individuelle Anfragen. |
| Stadt ging beim Anfrageeinstieg verloren | Gültiger Abholort wird übergeben; allgemeine Stadtlinks überschreiben kein bewusst gewähltes Paket. |
| Formular war auf Mobilgeräten sehr lang | Drei Schritte mit Preis, klaren Pflichtfeldern, optionalen Details und abschließender Aufstellung. Entwürfe einschließlich ausgewählter Dateien bleiben bei interner Navigation im Speicher dieses Tabs. Neuladen/Schließen verwirft den Entwurf; keine Speicherung auf der Festplatte. |
| Im Keramikpaket enthaltene Glasversiegelung und Lederpflege konnten zusätzliche Kosten erzeugen | Auswahl gesperrt, in der Preisberechnung ausgeschlossen und vor dem Speichern aus bezahlten Extras entfernt. Abweichender Mehraufwand bleibt Gegenstand der Begutachtung. Felgenextra bleibt separat: Demontage und Tiefenreinigung sind ausdrücklich zusätzlicher Umfang. |
| Hero nannte Leistungen und Ort nicht unmittelbar | Konkrete Überschrift, drei Leistungen, zwei Einstiege; mobile Abstände und Kontrast korrigiert. Animation bleibt pausierbar. |
| Alte SEO-Bezeichnungen und doppelte Titel/Überschriften | Zentrale deutsche Leistungsnamen, eigenständige Titel für allgemeine Leistung und Abholung, passende Stadtüberschriften. URLs und Canonicals bleiben erhalten. |
| Keine verifizierte Google-Rezensionsanbindung | Eindeutiges Profil und Links geprüft; offizieller serverseitiger GBP-Leseweg vorbereitet, ohne Zugang deaktiviert. |
| Nicht zugehörige Bilder als Vorher/Nachher-Vergleich | Vergleich entfernt, Aufnahmen als getrennte Arbeitsmotive bezeichnet. |
| Kartenvorschaubild enthielt „API KEY REQUIRED“ | Lokale Standortanzeige mit Adresse; interaktive Google-Karte weiterhin erst auf Klick. |

Preise, Fahrzeugfaktoren, Abholstaffeln, Anzahlungsbedingungen und manuelle Annahme bleiben bestehen. Neue Anfragen bleiben `neu`; keine automatische Bestätigung oder Zahlung wurde ergänzt. Es wurde keine echte Kundenanfrage gesendet.

## Google-Bewertungen: verifiziertes Profil, Zugang noch offen

- Nutzerlink: https://share.google/uzGQNkd2Nj3ZWJrXC
- Name: White-Gloss Detailing; Website white-gloss.de; Telefon 0152 33540284.
- Öffentliches Google-Profil: https://www.google.com/maps?cid=6247539959424569458
- Bewertungslink: https://search.google.com/local/writereview?placeid=ChIJt4HmUJZNl0cRclCPAX64s1Y
- Place ID: `ChIJt4HmUJZNl0cRclCPAX64s1Y`.
- Beobachtung am 15.09.2026: 5,0 Sterne bei 6 Bewertungen. Momentaufnahme, nicht in den Websitecode übernommen. Google zeigte eine bediente Region; eine öffentliche Straßenadresse im Profil wurde nicht bestätigt.

Ohne Zugang zeigt die Website ausschließlich die geprüften Links. Es werden keine erfundenen Sterne, Zahlen, Rezensionen oder Demo-Karten eingeblendet.

### Vorbereiteter Abruf

`GET /api/google-reviews` liest ausschließlich öffentliche Rezensionen des verifizierten eigenen Profils. Name, Place ID, Website und Telefon werden vor dem Abruf abgeglichen. Googles Gesamtbewertung und Gesamtzahl werden unverändert verwendet; maximal drei zuletzt aktualisierte Rezensionen sind als Auswahl gekennzeichnet. Keine Berechnung der Gesamtbewertung aus dieser Auswahl, keine KI-Umschreibung der Texte.

Server: eine Stunde Arbeitsspeicher, zeitgesteuerte Löschung, keine CDN-/Festplattenspeicherung, parallele Abrufe zusammengeführt, Zeitlimits und fünf Minuten Pause bei Fehlern. Im Browser keine Google-Skripte, Profilbilder oder externen Schriftarten für Rezensionen. Externe Google-Verbindungen entstehen erst beim Öffnen der Links. Keine selbstbezogenen Review-/AggregateRating-Suchmarkierungen.

### Exakt fehlende Voraussetzungen

1. Von Google genehmigtes Business-Profile-API-Projekt des Inhabers mit Zugriff auf das verifizierte Profil. Vorhandene Google-Anmeldung zur Administration reicht dafür nicht.
2. Ausdrücklich autorisierter OAuth-Zugang mit `https://www.googleapis.com/auth/business.manage`. Keine neue Berechtigung wurde erteilt.
3. Geschützte Laufzeitwerte: `GBP_CLIENT_ID`, `GBP_CLIENT_SECRET`, `GBP_REFRESH_TOKEN`, `GBP_LOCATION=accounts/<accountId>/locations/<locationId>`; zuletzt `GBP_REVIEWS_ENABLED=true` aktivieren. Geheimnisse nicht in Chat, Git, Client-Build oder `.env` eintragen.
4. Mit diesem Zugang Profilabgleich, tatsächliche API-Antwort und sichtbare Texte/Sterne/Anzahl erneut gegen Google prüfen. Erst danach ist die automatische Anbindung als verifiziert zu bezeichnen.

Es wurde kein kostenpflichtiger Dienst aktiviert und die kostenpflichtige Places-Schnittstelle nicht verwendet. Ein Konto-/Cloud-Projekt wurde nicht neu eingerichtet.

Offizielle Grundlagen: [GBP-Rezensionen](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list), [Profilabgleich](https://developers.google.com/my-business/reference/businessinformation/rest/v1/locations/get), [API-Richtlinien](https://developers.google.com/my-business/content/policies), [Google-Regeln für Review-Suchergebnisse](https://developers.google.com/search/docs/appearance/structured-data/review-snippet).

## SEO und vorhandene Messdaten

Able SEO: Projekt 3098, bestehender Audit 420 vom 13.09.2026, 30 Seiten. Gemeldet wurden 0 kritische Punkte, 4 Warnungen und 3 Hinweise. Die doppelten Titel/Überschriften wurden gezielt bearbeitet. Ein bloßer Hinweis zur Textlänge der Galerie rechtfertigte keine künstliche Textverlängerung; der 62 Zeichen lange Ledertitel wurde nicht aus kosmetischen Gründen gekürzt.

Search Console meldet in Able SEO `NotConnected`. Das sagt nichts darüber aus, ob außerhalb von Able eine Search Console vorhanden ist. Keine belastbaren Klick-, Suchanfragen- oder Besuchsdaten standen über diesen Zugang zur Verfügung. Die vorhandene einwilligungsabhängige Google-Ads-/Analytics-Logik und die Search-Console-Verifikationsunterstützung bleiben bestehen. Kein neues Tracking.

## Vertrauen und fehlendes Material

Inhabername und Werkstattort stammen aus den vorhandenen zentralen Firmendaten. Bestehende eigene Fahrzeug-/Werkstattmotive wurden weiterverwendet. Es wurden keine Kundenreferenzen oder Qualifikationen erfunden.

Für echte Fallbeispiele fehlen eindeutig zusammengehörende Vorher-/Nachher-Aufnahmen samt Beschreibung des ausgeführten Umfangs und dokumentierter Veröffentlichungsfreigabe bei Kundenmaterial. Für konkrete Keramik-Produktangaben fehlen belegter Hersteller/Produkt, Schichtsystem, erwartbare Standzeit, Pflegebedingungen und zugehörige Aufpreise. Deshalb keine neuen Produkt-, Haltbarkeits- oder Pflegeversprechen.

## Verifikation und Grenzen

- Vollständige Testsuite: 435 bestanden. Zusätzliche Regressionen prüfen Angebot/Stadt, ungültige Werte, Preisfaktoren, enthaltene Extras auch im gespeicherten Datensatz sowie Google-Identität, Gesamtwerte, Cache, Fehler und Wiederherstellung.
- TypeScript, Produktionsbuild und Lint erfolgreich; Lint enthält fünf bestehende Warnungen in unveränderten Bereichen.
- Isolierte Release-Prüfung: gerenderte Routen, echte 404-Antworten, Canonicals, interne Anfrageabläufe und Sitemap bestanden. Ausgehende Geschäftsprozesse werden dort abgefangen; kein Produktivversand.
- Browser: Smartphone 375 px, Tablet 768 px und Desktop 1280 px; Paket-/Stadtübernahme, Schrittwechsel, Kontakt-/Dateierhalt, Pflichtfeldfehler, nachvollziehbare Aufstellung und Google-Linkzustand geprüft. Kein horizontaler Überlauf in den geprüften Ansichten.
- Browser-Dateitest verwendete nur das lokale Favicon als Prüfbild, ohne Anfrageversand. Dies ist kein Nachweis einer produktiven Supabase-/E-Mail-/CRM-Verbindung.
- Automatische Google-Rezensionen wurden mit kontrollierten Antworten getestet; ein produktiver OAuth-Abruf ist mangels Zugang noch nicht verifiziert.
- Vorschau läuft lokal. Keine Veröffentlichung auf white-gloss.de, kein Merge. Veröffentlichung benötigt die ausdrückliche Freigabe des Inhabers.
