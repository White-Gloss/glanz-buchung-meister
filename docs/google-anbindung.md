# Google-Anbindung

Die Website ist technisch vollständig für Google vorbereitet. Was noch fehlt,
sind vier Werte aus den Google-Konten. Solange ein Wert leer bleibt, ist genau
dieser Teil inaktiv – die Website funktioniert unverändert weiter.

| Variable                           | Woher              | Wofür                                |
| ---------------------------------- | ------------------ | ------------------------------------ |
| `VITE_GOOGLE_SITE_VERIFICATION`    | Search Console     | Nachweis, dass die Domain uns gehört |
| `VITE_GA4_MEASUREMENT_ID`          | Google Analytics 4 | Besucherstatistik                    |
| `VITE_GOOGLE_ADS_CONVERSION_ID`    | Google Ads         | Anzeigenmessung                      |
| `VITE_GOOGLE_ADS_CONVERSION_LABEL` | Google Ads         | Anzeigenmessung                      |

Alle vier Werte sind **öffentlich** – sie stehen ohnehin im Quelltext jeder
Seite. Sie gehören deshalb in die eingecheckte `.env` und nicht in die
geheimen Umgebungsvariablen des Servers. Nach dem Eintragen ist ein neues
Deployment nötig, weil `VITE_`-Werte beim Build fest eingebaut werden.

## Die Kennungen des Kontos

Alle drei sind oeffentlich und stehen ohnehin im Quelltext bzw. in den
Google-Oberflaechen. Hier festgehalten, damit sie nicht gesucht werden muessen.

| Kennung | Bedeutung                               | Wert                | Im Code?                          |
| ------- | --------------------------------------- | ------------------- | --------------------------------- |
| `G-…`   | Mess-ID des Analytics-Datenstreams      | `G-RFX3GFRVBG`      | ja, als `VITE_GA4_MEASUREMENT_ID` |
| `GT-…`  | Google-Tag-Container um den Datenstream | `GT-K8HXCGP3`       | **nein, bewusst nicht**           |
| `AW-…`  | Conversion-ID aus Google Ads            | noch nicht angelegt | offen                             |

**Warum das `GT-` nicht eingetragen ist:** Es umschliesst dieselbe Property,
auf die auch die Mess-ID zeigt. Wuerde die Seite beide laden, zaehlte sie
jeden Seitenaufruf doppelt — ein Fehler, der lange unbemerkt bleibt, weil die
Zahlen plausibel aussehen. Im Echtzeitbericht wurde das nach dem Deployment
geprueft: drei Nutzer, drei `page_view` — nicht sechs.

Der Google-Tag-Container wird erst dann gebraucht, wenn Tags ueber den Tag
Manager statt ueber die Website verwaltet werden sollen. Das ist hier nicht
der Fall: Die Website laedt das Skript selbst, damit die Einwilligung
zuverlaessig davor greift.

## Wichtig: Reihenfolge

Search Console zuerst, dann Analytics, dann Ads. Ads setzt ein bestätigtes
Analytics-Konto nicht voraus, aber die Conversion-Aktion lässt sich sauberer
anlegen, wenn Analytics bereits misst.

---

## Schritt 1 – Google Search Console

Die Search Console zeigt, für welche Suchbegriffe die Seite gefunden wird und
ob Google Fehler beim Indexieren meldet. Sie kostet nichts und setzt keine
Cookies – sie braucht deshalb auch keine Einwilligung.

1. https://search.google.com/search-console öffnen und mit dem Google-Konto
   der Firma anmelden.
2. „Property hinzufügen" wählen. Es gibt zwei Varianten:
   - **Domain** (empfohlen): `white-gloss.de` eingeben. Deckt automatisch
     `www`, `https` und alle Unterseiten ab. Der Nachweis läuft über einen
     DNS-TXT-Eintrag bei IONOS.
   - **URL-Präfix**: `https://white-gloss.de` eingeben. Der Nachweis läuft
     über ein `meta`-Tag im Quelltext – dafür ist die Variable
     `VITE_GOOGLE_SITE_VERIFICATION` vorgesehen.
3. Je nach Variante:
   - **Domain-Variante:** Google zeigt einen TXT-Wert
     (`google-site-verification=…`). Diesen bei IONOS unter
     _Domains → white-gloss.de → DNS_ als **TXT-Eintrag** anlegen, Feld
     „Hostname" leer lassen bzw. `@`. Achtung: Der bereits vorhandene
     SPF-TXT-Eintrag für Resend darf dabei **nicht** überschrieben werden –
     eine Domain darf mehrere TXT-Einträge haben, aber nur einen SPF-Eintrag.
     Also einen **zusätzlichen** Eintrag anlegen, keinen bestehenden ändern.
   - **URL-Präfix-Variante:** Google zeigt ein fertiges `meta`-Tag. Nur den
     Wert aus `content="…"` kopieren und in `.env` als
     `VITE_GOOGLE_SITE_VERIFICATION` eintragen, dann deployen.
4. In der Search Console auf „Bestätigen" klicken. DNS-Änderungen bei IONOS
   brauchen erfahrungsgemäß wenige Minuten bis zu einer Stunde.
5. Danach unter _Sitemaps_ die Adresse `sitemap.xml` eintragen und absenden.
   Die Sitemap wird von der Website automatisch erzeugt und enthält alle
   öffentlichen Seiten inklusive Ratgeber-Beiträgen; `robots.txt` verweist
   bereits darauf.

## Schritt 2 – Google Analytics 4

1. https://analytics.google.com öffnen, Konto und Property für
   `white-gloss.de` anlegen (Zeitzone Berlin, Währung Euro).
2. Datenstream vom Typ **Web** für `https://white-gloss.de` anlegen.
3. Google zeigt die **Mess-ID** im Format `G-XXXXXXXXXX`. Diese als
   `VITE_GA4_MEASUREMENT_ID` in `.env` eintragen und deployen.
4. Den von Google angebotenen Tag-Code **nicht** zusätzlich einbauen – die
   Website lädt das Skript selbst, und zwar erst nach der Einwilligung.
5. In der Property unter _Verwaltung → Ereignisse_ das Ereignis
   `generate_lead` als **Schlüsselereignis** markieren. Die Website sendet es
   automatisch, sobald eine Terminanfrage erfolgreich abgeschickt wurde.

Wichtig zum Verständnis der Zahlen: Analytics zählt nur Besucher, die im
Cookie-Hinweis „Akzeptieren" gewählt haben. Die echten Besucherzahlen liegen
also höher als die angezeigten. Das ist kein Fehler, sondern die Folge der
Rechtslage (§ 25 TDDDG).

## Schritt 3 – Google Ads Conversion

Nur nötig, wenn tatsächlich Anzeigen geschaltet werden.

1. In Google Ads: _Tools → Conversions → Conversion-Aktion erstellen →
   Website_.
2. Als Kategorie „Kontakt" oder „Lead senden" wählen, Wert: „Für jede
   Conversion unterschiedliche Werte verwenden" (die Website sendet den
   berechneten Angebotspreis in Euro mit).
3. Beim Einrichten die Variante **Google-Tag** wählen. Google zeigt dann zwei
   Werte:
   - die **Conversion-ID** im Format `AW-123456789`
     → `VITE_GOOGLE_ADS_CONVERSION_ID`
   - das **Conversion-Label**, eine kurze Zeichenfolge
     → `VITE_GOOGLE_ADS_CONVERSION_LABEL`
4. Beide in `.env` eintragen und deployen. Der von Google angebotene
   Code-Schnipsel wird nicht gebraucht.

## Schritt 4 – Google Unternehmensprofil

Für ein lokales Handwerks- und Dienstleistungsgeschäft ist das der wirksamste
Google-Eintrag überhaupt – wichtiger als Analytics. Er läuft vollständig
außerhalb der Website:

1. https://business.google.com öffnen, Eintrag für „White Gloss Detailing" in
   Horb am Neckar anlegen oder beanspruchen.
2. Adresse, Telefonnummer und Öffnungszeiten **exakt** so eintragen wie im
   Impressum der Website. Abweichungen schwächen die lokale Auffindbarkeit.
3. Als Website `https://white-gloss.de` hinterlegen.
4. Kategorie: „Autoaufbereitung" bzw. „Autowäsche".
5. Fotos hochladen. Der Eintrag lebt von Vorher-Nachher-Bildern.

Die Website liefert Google bereits passende strukturierte Daten
(`LocalBusiness` mit Adresse, Öffnungszeiten und Leistungen) – der Eintrag im
Unternehmensprofil und diese Angaben sollten übereinstimmen.

---

## Betriebspanel: Google-Anmeldung

Die öffentliche Website lädt kein Google-Login. Nur `/login` (noindex) bietet
„Weiter mit Google“ für den Inhaber und beauftragte Mitarbeiter.

- Native Google-OAuth (nicht der Grok-Vorschau-Broker) über Better Auth.
- Client-ID/Secret: GitHub-Secrets `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET`.
  Der IONOS-Build bettet sie ein. Ohne Secrets bleibt die Taste sichtbar,
  die Anmeldung fällt auf E-Mail/Passwort zurück.
- Redirect-URI in der Google-Cloud-Konsole: `https://white-gloss.de/api/auth/callback/google`
- JavaScript-Ursprung: `https://white-gloss.de`
- Zulässig: Adressen `@white-gloss.de` sowie `ADMIN_EMAILS` / `OWNER_EMAIL`.
  Private Gmail-Konten sind nicht automatisch offen.
- X/Twitter bleibt aus.

Das erste Betriebskonto kann ohne Google eingerichtet werden: auf `/login`
mit `info@white-gloss.de` und einem Passwort (mindestens 10 Zeichen), solange
noch kein Benutzer existiert.

---

## Was die Website automatisch erledigt

- `sitemap.xml` wird bei jedem Aufruf neu erzeugt, inklusive Ratgeber-Beiträgen
  und eigenen Leistungen aus der Verwaltung.
- `robots.txt` verweist auf die Sitemap und sperrt Verwaltungsbereiche sowie
  persönliche Kundenlinks (`/angebot/`, `/kalender/`).
- Jede Seite hat Titel, Beschreibung, Canonical-Adresse und strukturierte
  Daten.
- Das Google-Skript für Analytics/Ads wird **erst nach aktiver Einwilligung** geladen.
  Ohne Einwilligung stellt die öffentliche Website keine Verbindung zu Google
  Analytics oder Ads her. Google Maps und die Betriebs-Anmeldung über Google
  sind eigene, bewusste Aktionen, kein Tracking.
- Eine erfolgreich abgeschickte Terminanfrage meldet automatisch die
  Conversion an Google Ads und das Ereignis `generate_lead` an Analytics –
  ebenfalls nur mit Einwilligung.

---

## Stadtseiten: was noch fehlt

Die dreizehn Stadtseiten unter `/abholservice/…` sind die einzigen lokalen
Seiten, die Google indexiert. Sie teilten sich ursprünglich rund die Hälfte
ihres Textes wortwörtlich. Durch berechnete Kennzahlen je Stadt, eine
Vergleichstabelle der Nachbarorte und den Abbau doppelter Paketbeschreibungen
liegt die Wiederholungsquote jetzt bei knapp 47 statt 51 Prozent.

Weiter kommt man mit Technik nicht. Der Rest sind Ablauf, Leistungsliste und
FAQ – die überall gleich sein müssen, weil sie überall gleich sind.

**Was den Unterschied macht, kann nur aus dem Betrieb kommen:** das Feld
`localProof` in `src/lib/pickupLocations.ts`. Zwei bis vier Sätze je Stadt
über tatsächlich dort betreute Fahrzeuge – ein konkreter Auftrag, eine
wiederkehrende Kundschaft, eine Besonderheit bei der Übergabe. Ist das Feld
leer, entfällt der Abschnitt; er darf **nicht** mit erfundenen Angaben
gefüllt werden. Das wären falsche Aussagen über den Betrieb auf der Website
eines realen Unternehmens, und Google erkennt generische Ortsfüllsel
zuverlässig.

Dieselbe Überlegung gilt für Fotos: Ein einziges echtes Vorher-Nachher-Bild
eines Fahrzeugs aus dem jeweiligen Ort wiegt mehr als jede Textoptimierung.

### Warum die 91 Kombiseiten weiter ausgesperrt bleiben

Die Seiten unter `/leistungen/[leistung]/[stadt]` tragen bewusst `noindex`.
Sie sind zu 81 Prozent wortgleich; würde man sie freigeben, wären es 91
nahezu identische Seiten auf einmal – genau das Muster, das Google als
Doorway Pages einstuft. Die Freigabe lohnt erst, wenn die Stadtseiten selbst
echten örtlichen Inhalt tragen, und dann schrittweise für die wichtigsten
Orte.
