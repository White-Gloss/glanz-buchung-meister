# Produktion & Deployment

Die Domain **white-gloss.de** und ihre DNS-Verwaltung bleiben bei **IONOS**. Diese Anleitung verändert weder Domain, Nameserver noch DNS-Einträge. Die Anwendung kann unabhängig davon auf einer Node-fähigen Deployment-Plattform betrieben werden.

## Build und Start

| Einstellung | Wert |
|---|---|
| Branch | `main` |
| Node.js | `20.19` oder neuer, empfohlen: 22 |
| Installieren | `npm ci` |
| Prüfen | `npm run test && npm run lint` |
| Bauen | `npm run build` |
| Start | `node .output/server/index.mjs` |

`.output` wird bei jedem Deployment frisch erzeugt und gehört nicht ins Repository.

## Umgebungsvariablen

### Öffentliche Werte beim Build

`VITE_`-Variablen werden in das Browser-Bundle eingebaut. Sie dürfen deshalb ausschließlich nicht geheime Werte enthalten und müssen bereits beim Build verfügbar sein.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- optional: `VITE_GOOGLE_ADS_CONVERSION_ID`, `VITE_GOOGLE_ADS_CONVERSION_LABEL`
- optional: `VITE_META_PIXEL_ID`

### Serverwerte

Diese Werte gehören ausschließlich in die geschützte Umgebungsverwaltung der Deployment-Plattform, **nie** in Git oder Browser-Variablen:

- `DATABASE_URL`, `POSTGRES_URL` oder `SUPABASE_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` – erforderlich für serverseitig geprüfte Fahrzeugfoto-/Video-Uploads
- `RESEND_API_KEY`, `MAIL_FROM`, optional `MAIL_TO_OWNER`
- optional: `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_TEST_EVENT_CODE`

> Das Setzen oder Ändern dieser Werte erfolgt in **hPanel → Hermes Agent → Dashboard → Environment**, nicht in Shell-Profilen oder einer eingecheckten `.env`.

## Supabase vor dem App-Deployment

1. Alle Migrationen in `supabase/migrations/` über den normalen Supabase-Workflow ausführen.
2. Besonders wichtig ist `20260812231500_security_hardening.sql`. Sie schließt direkte anonyme Medien-Uploads, verhindert den ersten öffentlichen Admin, begrenzt Angebotslinks und schützt vor Dubletten.
3. Prüfen, dass mindestens ein berechtigter Admin vorhanden ist, bevor die Migration ausgerollt wird.
4. Sicherstellen, dass `SUPABASE_SERVICE_ROLE_KEY` als geschützte Servervariable gesetzt ist.

## DNS bei IONOS: E-Mail-Domain für Resend

Falls Resend für E-Mails verwendet wird:

1. In Resend `white-gloss.de` als Domain hinzufügen.
2. Die von Resend vorgegebenen SPF-/DKIM-/MX-Einträge **in IONOS** übernehmen.
3. Erst nach der Resend-Verifizierung `MAIL_FROM` auf eine Adresse dieser Domain setzen.
4. Testmail an Gmail, Outlook und WEB.DE senden und Spam-Ordner prüfen.

## Prüfung nach dem Deployment

- `https://white-gloss.de/`
- `https://white-gloss.de/faq`
- `https://white-gloss.de/ratgeber`
- `https://white-gloss.de/sitemap.xml`
- `https://white-gloss.de/admin`
- eine echte Testanfrage: Eingangsbestätigung, Admin-Anzeige, Danke-Seite und ggf. Conversion-Event prüfen

Bei einem fehlerhaften Build die vorige Release-Version beibehalten und den fehlerhaften Commit gezielt zurückrollen.