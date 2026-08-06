# Deployment auf Hostinger

Die Website läuft bei Hostinger als Node-Anwendung. Der Code wird über die
Git-Bereitstellung im hPanel geholt — Hostinger zieht sich den Stand also
selbst aus GitHub. Zugangsdaten müssen dafür nirgends hinterlegt werden.

Diese Datei beschreibt, was die Anwendung zum Bauen und Starten braucht.
Die genauen Menüpfade im hPanel sind hier bewusst nicht abgebildet: Hostinger
ändert die Oberfläche regelmäßig, und eine veraltete Klickanleitung wäre
schlimmer als keine. Die Werte unten sind das, was Sie dort eintragen.

## Kurzfassung

| Was                  | Wert                                    |
| -------------------- | --------------------------------------- |
| Branch               | `main`                                  |
| Node-Version         | `20.19` oder neuer (empfohlen: 22)      |
| Installationsbefehl  | `npm ci`                                |
| Build-Befehl         | `npm run build`                         |
| Startdatei           | `.output/server/index.mjs`              |
| Startbefehl          | `node .output/server/index.mjs`         |

## Ablauf eines Deployments

1. Änderungen werden nach `main` gemergt.
2. Hostinger holt den neuen Stand (manuell im hPanel oder automatisch, siehe
   unten).
3. Auf dem Server laufen `npm ci` und `npm run build`. Dabei entsteht der
   Ordner `.output`.
4. Der Node-Prozess wird neu gestartet und bedient die Seite aus `.output`.

`.output` liegt bewusst nicht im Repository (siehe `.gitignore`) — der Build
entsteht immer frisch aus dem Quellcode.

## Umgebungsvariablen

Hier gibt es einen Stolperstein, der leicht zu übersehen ist: **Variablen mit
`VITE_`-Präfix werden beim Bauen fest in die Browser-Dateien eingebacken.**
Sie müssen also bereits vorhanden sein, wenn `npm run build` läuft — ein
späteres Setzen ändert nichts mehr. Alle anderen Variablen liest der Server
erst zur Laufzeit.

### Öffentliche Werte — stehen in `.env` im Repository

Diese Datei liegt absichtlich im Git, weil Hostinger sie beim Bauen braucht.
Sie enthält ausschließlich Werte, die ohnehin im Quelltext jeder Seite
sichtbar sind:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_META_PIXEL_ID` — sobald hier eine ID steht, lädt der Meta-Pixel
  (weiterhin nur nach erteilter Cookie-Einwilligung)

### Geheimnisse — ausschließlich in den Hostinger-Umgebungsvariablen

Diese Werte dürfen **niemals** in `.env` oder sonst ins Repository:

| Variable                                       | Wofür                                       |
| ---------------------------------------------- | ------------------------------------------- |
| `META_PIXEL_ID`                                | Conversions API, serverseitig               |
| `META_CAPI_ACCESS_TOKEN`                       | Zugriffstoken der Conversions API           |
| `RESEND_API_KEY`                               | E-Mail-Versand                              |
| `SUPABASE_SERVICE_ROLE_KEY`                    | optional, serverseitige Vollzugriffe        |
| `DATABASE_URL` / `POSTGRES_URL` / `SUPABASE_DB_URL` | direkte Datenbankverbindung            |

Ein Token mit `VITE_`-Präfix zu setzen würde es in den öffentlichen
Browser-Dateien veröffentlichen. Deshalb heißen die serverseitigen Variablen
bewusst ohne dieses Präfix.

## Automatisches Deployment einrichten

Damit ein Merge nach `main` von selbst ankommt:

1. Im hPanel bei der Git-Bereitstellung die **Webhook-URL** kopieren.
2. In GitHub unter **Settings → Webhooks → Add webhook** einfügen:
   - Payload URL: die kopierte Adresse
   - Content type: `application/json`
   - Trigger: „Just the push event"
3. Speichern. Ab dann löst jeder Push auf `main` ein Deployment aus.

Ohne diesen Schritt funktioniert alles genauso, nur muss die Bereitstellung
im hPanel jedes Mal von Hand angestoßen werden.

## Nach dem Deployment prüfen

Diese Adressen sollten erreichbar sein:

- `https://whitegloss.de/` — Startseite
- `https://whitegloss.de/faq` — FAQ-Seite
- `https://whitegloss.de/ratgeber` — Ratgeber-Übersicht
- `https://whitegloss.de/sitemap.xml` — enthält `/faq` und `/ratgeber`
- `https://whitegloss.de/admin` — Anmeldung als Administrator

Solange im Admin-Panel noch keine Inhalte angelegt sind, zeigen `/faq` und
`/ratgeber` einen freundlichen Hinweistext statt einer leeren Seite. Das ist
so gewollt und kein Fehler.

Die strukturierten Daten lassen sich anschließend im
[Test für Rich-Suchergebnisse](https://search.google.com/test/rich-results)
prüfen — dort sollten bei einem Ratgeber-Beitrag `BlogPosting`,
`BreadcrumbList` und, sofern FAQs zugeordnet sind, `FAQPage` erscheinen.

## Wenn etwas schiefgeht

Der Build bricht ab und die alte Version läuft weiter — Hostinger tauscht erst
nach einem erfolgreichen Build. Führt ein Deployment trotzdem zu einem Fehler
auf der Seite:

1. Im hPanel das Build-Protokoll ansehen. `npm ci` scheitert zum Beispiel,
   wenn `package.json` und `package-lock.json` nicht zusammenpassen.
2. Zurückrollen, indem in GitHub der letzte Commit auf `main` revertiert und
   erneut bereitgestellt wird.

Fehlen die Supabase-Variablen, zeigt die Seite bewusst einen Hinweis statt
einer weißen Seite — dann stimmt etwas an der Konfiguration nicht.

## Hinweis zu GitHub Actions

Im Repository gibt es bewusst keine GitHub-Actions-Workflows: In diesem
GitHub-Konto lassen sich derzeit keine Actions ausführen. Jeder Lauf bricht
nach wenigen Sekunden ab, ohne einen Runner zu bekommen — das betrifft auch
GitHubs eigene Sicherheitsprüfungen und ist unabhängig vom Projektcode.

Für das Deployment spielt das keine Rolle, weil Hostinger den Code selbst
holt und baut. Vor einem Merge sollten die Prüfungen aber lokal laufen:

```sh
npm run lint
npx tsc --noEmit
npm run build
```

Sobald Actions im Konto verfügbar sind, lohnt sich ein CI-Workflow, der genau
diese drei Befehle bei jedem Pull Request ausführt.
