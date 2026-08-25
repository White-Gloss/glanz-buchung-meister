-- =====================================================================
-- Minimale Nachbildung der Supabase-Umgebung — NUR FÜR DEN TEST
-- =====================================================================
--
-- WOFÜR
-- Damit sich prüfen lässt, ob die Migrationen eine Datenbank von null
-- aufbauen können, braucht ein nacktes PostgreSQL das, was Supabase
-- mitbringt: die Rollen `anon`, `authenticated` und `service_role`, das
-- Schema `auth` mit `auth.uid()` und `auth.users`, und das Schema
-- `storage` mit `buckets` und `objects`.
--
-- DIESE DATEI GEHÖRT NIEMALS IN EINE ECHTE DATENBANK.
-- Sie liegt bewusst NICHT unter `supabase/migrations/`, damit die
-- Supabase-CLI sie nicht einspielt. `auth.uid()` liefert hier eine
-- Einstellung statt eines geprüften JWT — als Sicherheitsmechanismus wäre
-- das wertlos. Sie dient allein dazu, die Migrationen syntaktisch und in
-- ihrer Reihenfolge durchlaufen zu lassen.
--
-- WAS SIE NICHT LEISTET
-- Sie bildet Supabase nicht vollständig nach. Wenn eine Migration künftig
-- etwas benutzt, das hier fehlt, schlägt die Prüfung fehl und diese Datei
-- muss ergänzt werden — das ist beabsichtigt und besser als ein
-- stillschweigend übersprungener Test.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  created_at timestamptz DEFAULT now()
);

-- Im Test gibt es keinen JWT. Liefert, was zuvor gesetzt wurde, sonst NULL.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  metadata jsonb
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA auth, storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
