---
name: Database architecture split
description: Bookings data lives in Replit-managed Postgres; Supabase is used for auth only. Key implications for future work.
---

# Database architecture split

## The rule
All booking data operations (createBooking, listBookings, updateBookingStatus, updateDepositStatus, deleteBooking, listAuditLog) read/write from Replit's managed PostgreSQL (`DATABASE_URL`), NOT from Supabase.

Supabase is used only for:
- User authentication (JWT session handling)
- `has_role` admin checks (calls `context.supabase.rpc("has_role", ...)`)
- Reading `service_prices` for the client-side price display (root loader in `__root.tsx`)

**Why:** The Supabase database has RLS that blocks anonymous inserts on `bookings`, and the `create_booking_public` SECURITY DEFINER function was never applied there. Rather than requiring the user to provide the service role key or manually run SQL, the booking engine was wired to Replit Postgres where all migrations ran successfully.

## How to apply
- `src/lib/db.server.ts` — thin `pg` Pool wrapper (`query`, `queryOne`)
- `src/lib/bookings.functions.ts` — imports from `db.server` for all data operations
- `src/lib/pricing.functions.ts` — still writes to Supabase only (tech debt: price changes won't sync to Replit Postgres `service_prices` table used by `create_booking_public`)

## Known tech debt
- `updateServicePrice` in `pricing.functions.ts` updates Supabase `service_prices` but NOT Replit Postgres. The `create_booking_public` function reads from Replit Postgres. So admin price changes via the UI won't affect booking totals until also synced to Replit Postgres.
- Admin `has_role` checks call Supabase — admin users must be provisioned in Supabase `user_roles` table.
