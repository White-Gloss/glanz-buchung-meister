# White Gloss Detailing

Website und Buchungssystem für White Gloss Detailing, gebaut mit TanStack Start,
React, TypeScript und Tailwind CSS. Das Projekt ist mit Lovable verbunden.

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

Login, Buchungen und dynamische Preise benötigen die bereits in Lovable
hinterlegten Backend-Zugänge:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`, `POSTGRES_URL` oder `SUPABASE_DB_URL`
- optional serverseitig: `SUPABASE_SERVICE_ROLE_KEY`

Zugangsdaten gehören in die lokale `.env` beziehungsweise in die
Umgebungsvariablen des Hostings und dürfen nicht in Git veröffentlicht werden.

## Prüfen und bauen

```sh
npm run build
npx tsc --noEmit
```

## Über Lovable veröffentlichen

Änderungen auf den mit Lovable verbundenen GitHub-Branch übertragen, das
Projekt im Lovable-Editor öffnen und dort **Publish** wählen. Die
Produktionsdomain ist `https://whitegloss.de`.
