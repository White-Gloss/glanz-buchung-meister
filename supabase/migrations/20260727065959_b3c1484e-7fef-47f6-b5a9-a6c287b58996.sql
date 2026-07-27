-- has_role als SECURITY INVOKER: läuft mit den Rechten des Aufrufers.
-- Durch die SELECT-Policy "Users can read own roles" sieht ein Nutzer nur die eigene Rolle,
-- fremde Rollen liefern immer false. Kein erhöhter Rechtekontext mehr nötig.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;