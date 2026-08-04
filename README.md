# White Gloss Detailing

Website und Buchungssystem für White Gloss Detailing, gebaut mit TanStack Start,
React, TypeScript, Tailwind CSS und Nitro. Der Produktionsbetrieb läuft als
Node-Anwendung bei Hostinger.

## Lokal installieren

Benötigt werden Git, npm und Node.js `20.19` oder neuer.

```sh
git clone https://github.com/White-Gloss/glanz-buchung-meister.git
cd glanz-buchung-meister
npm ci
npm run dev
```

Die lokale Website ist anschließend unter `http://localhost:5000` erreichbar.

## Umgebungsvariablen

Login, Buchungen, Galerie und dynamische Preise benötigen folgende
Umgebungsvariablen:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`, `POSTGRES_URL` oder `SUPABASE_DB_URL`
- optional serverseitig: `SUPABASE_SERVICE_ROLE_KEY`
- optional für E-Mails: `RESEND_API_KEY`

Zugangsdaten gehören in die lokale `.env` beziehungsweise in die
Umgebungsvariablen von Hostinger. Geheimnisse dürfen nicht in Git veröffentlicht
werden.

## Prüfen und bauen

```sh
npm run lint
npx tsc --noEmit
npm run build
```

Der Produktionsstart erfolgt aus dem erzeugten Build:

```sh
node .output/server/index.mjs
```
