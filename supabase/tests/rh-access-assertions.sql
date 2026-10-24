CREATE FUNCTION public.expect_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
 RAISE EXCEPTION 'Expected permission denial: %', statement;
END; $$;

-- Users must not grant themselves the independent export permission.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
SELECT public.expect_denied($s$UPDATE public.app_users SET is_rh=true WHERE id=2$s$);
RESET ROLE;

-- An administrator may grant it without changing the user's role or direction.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
UPDATE public.app_users SET is_rh=true WHERE id=2;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id=2 AND role='user' AND is_rh) THEN
  RAISE EXCEPTION 'Export flag changed or failed to preserve the base role';
 END IF;
 IF app_private.can_create_operations() OR app_private.can_edit_planning() OR app_private.is_application_admin() THEN
  RAISE EXCEPTION 'Export flag grants unrelated business privileges';
 END IF;
END; $$;
SELECT public.expect_denied($s$UPDATE public.app_users SET is_rh=false WHERE id=2$s$);
SELECT public.expect_denied($s$UPDATE public.app_users SET role='admin' WHERE id=2$s$);
RESET ROLE;
