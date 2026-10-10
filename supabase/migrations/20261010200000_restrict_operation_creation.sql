BEGIN;

-- Requires the profile/role protection migration: creation trusts only canonical roles.
CREATE OR REPLACE FUNCTION app_private.can_create_operations()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_users
    WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin', 'initiator'));
$$;
REVOKE ALL ON FUNCTION app_private.can_create_operations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.can_create_operations() TO authenticated;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods', 'exceptional_on_calls', 'exceptional_works']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE INSERT ON public.%I FROM PUBLIC, anon', table_name);
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT INSERT ON public.%I TO authenticated', table_name);
    EXECUTE format('DROP POLICY IF EXISTS operation_creation_roles ON public.%I', table_name);
    -- Restrictive policies AND with the existing policies, including legacy ALL/true policies.
    -- Existing operation reads/updates and intervention writes are intentionally unchanged.
    EXECUTE format('CREATE POLICY operation_creation_roles ON public.%I AS RESTRICTIVE
      FOR INSERT TO authenticated WITH CHECK (app_private.can_create_operations())', table_name);
  END LOOP;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
