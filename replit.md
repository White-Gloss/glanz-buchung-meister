# White Gloss Detailing – Fahrzeugaufbereitung

A premium car detailing booking web app for White Gloss Detailing (Horb am Neckar, Germany). Built with Lovable, TanStack Start (SSR), React 19, Tailwind CSS v4, and Supabase.

## Stack

- **Framework**: TanStack Start (SSR via Vite + Nitro)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui (Radix UI)
- **Backend/DB**: Supabase (auth + database)
- **Language**: TypeScript

## Running the app

```bash
npm run dev   # starts Vite dev server on port 5000
```

The workflow `Start application` runs `npm run dev` automatically.

## Environment variables

All required values are in `.env`:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

## Key routes

- `/` — Homepage with booking wizard
- `/auth` — Auth page
- `/abholservice` — Pickup service landing
- `/abholservice/:city` — City-specific pickup pages

## Notes

- Requires **Node.js 22+** (Supabase Realtime uses native WebSocket)
- Logo images are served from Lovable's CDN (`/__l5e/assets-v1/...`) — they will appear broken in the Replit preview but work in the deployed app
- The app uses SSR; server entry is `src/server.ts`

## User preferences

_None recorded yet._
