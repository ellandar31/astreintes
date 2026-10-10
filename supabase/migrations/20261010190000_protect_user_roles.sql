BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- Read the canonical role outside app_users RLS to avoid recursive policies.
-- No arguments: callers cannot ask the helper to impersonate another identity.
CREATE OR REPLACE FUNCTION app_private.is_application_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE auth_user_id = (SELECT auth.uid()) AND role = 'admin'::public.user_role
  );
$$;
REVOKE ALL ON FUNCTION app_private.is_application_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_application_admin() TO authenticated;

-- Email comes from Auth, never JWT user_metadata or the browser's profile payload.
CREATE OR REPLACE FUNCTION app_private.session_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT email FROM auth.users WHERE id = (SELECT auth.uid());
$$;
REVOKE ALL ON FUNCTION app_private.session_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.session_email() TO authenticated;

CREATE OR REPLACE FUNCTION app_private.guard_user_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Trusted maintenance and server credentials are not browser identities.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF app_private.is_application_admin() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR NEW.auth_user_id IS DISTINCT FROM auth.uid()
     OR NEW.email IS DISTINCT FROM app_private.session_email() THEN
    RAISE EXCEPTION 'Profile identity must match the authenticated account' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'user'::public.user_role THEN
      RAISE EXCEPTION 'Only an administrator can assign roles' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
       OR NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only an administrator can change profile privileges or identity' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.guard_user_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_user_profile ON public.app_users;
CREATE TRIGGER guard_user_profile BEFORE INSERT OR UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION app_private.guard_user_profile();

-- Remove every old policy: permissive policies combine with OR, so leaving one
-- behind would keep the original privilege-escalation route open.
DO $$
DECLARE policy_record record;
BEGIN
  FOR policy_record IN SELECT policyname FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_users'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.app_users', policy_record.policyname);
  END LOOP;
END;
$$;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_users TO authenticated;
REVOKE ALL ON SEQUENCE public.app_users_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.app_users_id_seq TO authenticated;

-- Directory reads are retained for calendar/visa joins in this first stage.
-- Row/column read isolation belongs to the separate operations-access migration.
CREATE POLICY profiles_read ON public.app_users FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_insert ON public.app_users FOR INSERT TO authenticated
  WITH CHECK (app_private.is_application_admin() OR (auth_user_id = (SELECT auth.uid()) AND role = 'user'));
CREATE POLICY profiles_update ON public.app_users FOR UPDATE TO authenticated
  USING (app_private.is_application_admin() OR auth_user_id = (SELECT auth.uid()))
  WITH CHECK (app_private.is_application_admin() OR auth_user_id = (SELECT auth.uid()));
CREATE POLICY profiles_delete ON public.app_users FOR DELETE TO authenticated
  USING (app_private.is_application_admin());

NOTIFY pgrst, 'reload schema';
COMMIT;
