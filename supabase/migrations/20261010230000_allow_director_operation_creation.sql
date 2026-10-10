BEGIN;

-- Extend the existing INSERT policies through their shared canonical role check.
-- Directors retain full planning access and can now create all operation families.
CREATE OR REPLACE FUNCTION app_private.can_create_operations()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.app_users
  WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin', 'initiator', 'director'));
$$;
REVOKE ALL ON FUNCTION app_private.can_create_operations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.can_create_operations() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
