-- =====================================================================
-- Nachtrag: zwei Tabellen, die es nur in der Datenbank gab
-- =====================================================================
--
-- WAS FEHLTE
-- `calendar_feed_tokens` und `customer_notes` werden von der Anwendung
-- benutzt und stehen in den erzeugten Typen — angelegt hat sie aber keine
-- Migration. Sie sind irgendwann direkt in der Datenbank entstanden.
--
-- WAS DAS ANRICHTETE
-- Die Migrationskette konnte die Datenbank nicht mehr aufbauen. Auf einer
-- leeren Datenbank brach `20260810031019_optimize_auth_rls_policies.sql`
-- in Zeile 27 mit „relation public.calendar_feed_tokens does not exist" ab
-- — und weil danach nichts mehr lief, blieben auch sämtliche folgenden
-- Policy-Optimierungen dieser Datei aus, ohne dass es auffiel. Eine
-- Testumgebung oder ein Wiederaufbau nach einem Ausfall wäre also nicht
-- dieselbe Datenbank gewesen, sondern eine stillschweigend andere.
--
-- WARUM DIESE DATEI NICHTS ÜBERSCHREIBT
-- Der Inhalt hier ist REKONSTRUIERT — aus `src/integrations/supabase/types.ts`
-- (aus der Produktion erzeugt) und daraus, wie die Anwendung die Tabellen
-- benutzt. Er ist NICHT aus einem Abzug der Produktion gewonnen. Deshalb
-- passiert alles nur dann, wenn die Tabelle noch gar nicht existiert. Wo
-- die Wahrheit bereits steht, bleibt sie unangetastet; gefüllt wird nur die
-- Leere. Der Dateiname liegt bewusst vor der Optimierungsmigration, damit
-- ein Aufbau von null in der richtigen Reihenfolge läuft.
--
-- OFFEN: Ein Abgleich mit einem echten Schema-Abzug der Produktion. Solange
-- der aussteht, gilt der Wiederaufbau als plausibel, nicht als bewiesen
-- gleich.

-- ---------------------------------------------------------------------
-- calendar_feed_tokens: je Administrator eine schwer zu erratende Adresse,
-- unter der der eigene Terminkalender als ICS abrufbar ist.
-- ---------------------------------------------------------------------
DO $migration$
BEGIN
  IF to_regclass('public.calendar_feed_tokens') IS NOT NULL THEN
    RAISE NOTICE 'calendar_feed_tokens besteht bereits - unveraendert gelassen';
  ELSE
    EXECUTE $ddl$
      CREATE TABLE public.calendar_feed_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        -- Genau ein Token je Person: die Anwendung liest mit maybeSingle().
        user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
        -- Wird beim Anlegen nicht mitgegeben, muss also aus der Vorgabe kommen.
        token uuid NOT NULL DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    $ddl$;

    EXECUTE 'ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY';

    -- Bereits in der Form, die `20260810031019` herstellt: auth.uid() einmal
    -- je Anweisung statt einmal je Zeile. So ergibt das spätere ALTER POLICY
    -- denselben Stand und nicht einen anderen.
    EXECUTE $ddl$
      CREATE POLICY "Admins can create own token"
        ON public.calendar_feed_tokens FOR INSERT TO authenticated
        WITH CHECK (
          (SELECT auth.uid()) = user_id
          AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    $ddl$;

    EXECUTE $ddl$
      CREATE POLICY "Admins can read own token"
        ON public.calendar_feed_tokens FOR SELECT TO authenticated
        USING (
          (SELECT auth.uid()) = user_id
          AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    $ddl$;

    EXECUTE $ddl$
      CREATE POLICY "Admins can regenerate own token"
        ON public.calendar_feed_tokens FOR UPDATE TO authenticated
        USING (
          (SELECT auth.uid()) = user_id
          AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
        WITH CHECK (
          (SELECT auth.uid()) = user_id
          AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        )
    $ddl$;

    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.calendar_feed_tokens TO authenticated';
    EXECUTE 'GRANT ALL ON public.calendar_feed_tokens TO service_role';
  END IF;
END
$migration$;

-- ---------------------------------------------------------------------
-- customer_notes: freie Notiz des Betriebs zu einer Kundenadresse.
-- ---------------------------------------------------------------------
DO $migration$
BEGIN
  IF to_regclass('public.customer_notes') IS NOT NULL THEN
    RAISE NOTICE 'customer_notes besteht bereits - unveraendert gelassen';
  ELSE
    EXECUTE $ddl$
      CREATE TABLE public.customer_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        -- Die Anwendung schreibt mit upsert(onConflict: 'customer_email');
        -- ohne diese Eindeutigkeit schlaegt das fehl.
        customer_email text NOT NULL UNIQUE,
        note text NOT NULL DEFAULT '',
        updated_at timestamptz NOT NULL DEFAULT now(),
        -- Bleibt erhalten, wenn das Administratorkonto verschwindet: die
        -- Notiz gehoert dem Betrieb, nicht der Person, die sie geschrieben hat.
        updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
      )
    $ddl$;

    EXECUTE 'ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY';

    EXECUTE $ddl$
      CREATE POLICY "Admins can read customer notes"
        ON public.customer_notes FOR SELECT TO authenticated
        USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $ddl$;

    EXECUTE $ddl$
      CREATE POLICY "Admins can write customer notes"
        ON public.customer_notes FOR INSERT TO authenticated
        WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $ddl$;

    EXECUTE $ddl$
      CREATE POLICY "Admins can update customer notes"
        ON public.customer_notes FOR UPDATE TO authenticated
        USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
        WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $ddl$;

    -- Eine geleerte Notiz loescht die Zeile (siehe customerNotes.functions.ts).
    -- Ohne diese Regel schlaegt genau das fehl.
    EXECUTE $ddl$
      CREATE POLICY "Admins can delete customer notes"
        ON public.customer_notes FOR DELETE TO authenticated
        USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $ddl$;

    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated';
    EXECUTE 'GRANT ALL ON public.customer_notes TO service_role';
  END IF;
END
$migration$;
