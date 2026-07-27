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

Sensitive values must be added as Replit Secrets (Tools → Secrets). The non-secret URL is already set as a Replit env var.

| Variable | Where to find it | Required for |
|---|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Set automatically | Client + server |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` (already committed) | Client + server auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → Service Role | Fallback booking path only |
| `SESSION_SECRET` | Already set as Replit Secret | Session signing |

## Supabase setup – one-time steps

### 1. Database migrations (already applied)

All migration files in `supabase/migrations/` have been applied to project `kyfzxikckpiqzcnzjgnj`. The schema is live.

### 2. Enable the booking creation function (choose ONE option)

**Option A — no secrets needed (recommended):**
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/kyfzxikckpiqzcnzjgnj/sql/new)
2. Paste the contents of `supabase/migrations/20260727080000_create_booking_public_fn.sql`
3. Click **Run**

This creates the `create_booking_public` SECURITY DEFINER function. The server function calls it using the existing publishable key — no service-role secret needed.

**Option B — add the service-role secret:**
1. Supabase dashboard → Project Settings → API → copy **Service Role** key
2. Add it as a Replit Secret named `SUPABASE_SERVICE_ROLE_KEY`

The `createBooking` server function tries Option A first; if the function isn't deployed it automatically falls back to Option B.

## Key routes

- `/` — Homepage with booking wizard
- `/auth` — Admin login / signup (Supabase Auth)
- `/admin` — Bookings dashboard (admin only)
- `/abholservice` — Pickup service landing
- `/abholservice/:city` — City-specific pickup pages

## Architecture notes

- The booking wizard (`src/components/BookingWizard.tsx`) calls `createBooking` (a TanStack Start server function in `src/lib/bookings.functions.ts`).
- `createBooking` uses a dual path: anon RPC → admin client fallback (see above).
- All price computation happens server-side — the `create_booking_public` SQL function reads `service_prices` and recomputes totals; caller-provided amounts are never trusted.
- Requires **Node.js 22+** (Supabase Realtime uses native WebSocket).
- The app uses SSR; server entry is `src/server.ts`.

## User preferences

_None recorded yet._
