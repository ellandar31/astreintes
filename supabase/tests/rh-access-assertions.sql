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

-- RH commands change only treatment, for all three families, atomically.
INSERT INTO public.regular_on_call_periods(id,user_id,starts_at,ends_at,sent_to_rh_at)
 VALUES (990,2,now(),now()+interval '1 hour',now());
INSERT INTO public.exceptional_on_calls(id,title,sent_to_rh_at) VALUES (990,'RH treatment',now());
INSERT INTO public.exceptional_works(id,title,sent_to_rh_at) VALUES (990,'RH treatment',now());
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
SELECT public.expect_denied($s$SELECT public.set_rh_treatment('[{"type":"regular","id":"990"}]',true)$s$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
SELECT public.set_rh_treatment('[{"type":"regular","id":"990"},{"type":"exceptionalOnCall","id":"990"},{"type":"exceptionalWork","id":"990"}]',true);
DO $$ BEGIN
 IF (SELECT treated_at IS NULL FROM public.regular_on_call_periods WHERE id=990)
 OR (SELECT treated_at IS NULL FROM public.exceptional_on_calls WHERE id=990)
 OR (SELECT treated_at IS NULL FROM public.exceptional_works WHERE id=990) THEN
  RAISE EXCEPTION 'Batch treatment not persisted';
 END IF;
END; $$;
SELECT public.set_rh_treatment('[{"type":"regular","id":"990"},{"type":"exceptionalOnCall","id":"990"},{"type":"exceptionalWork","id":"990"}]',false);
DO $$ BEGIN
 IF (SELECT treated_at IS NOT NULL FROM public.regular_on_call_periods WHERE id=990)
 OR (SELECT treated_at IS NOT NULL FROM public.exceptional_on_calls WHERE id=990)
 OR (SELECT treated_at IS NOT NULL FROM public.exceptional_works WHERE id=990) THEN
  RAISE EXCEPTION 'Treatment cancellation not persisted';
 END IF;
 BEGIN
  PERFORM public.set_rh_treatment('[{"type":"regular","id":"990"},{"type":"exceptionalWork","id":"999999"}]',true);
  RAISE EXCEPTION 'Missing submission accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT treated_at IS NOT NULL FROM public.regular_on_call_periods WHERE id=990) THEN
  RAISE EXCEPTION 'Failed batch was partially persisted';
 END IF;
END; $$;
RESET ROLE;
UPDATE public.app_users SET deleted_at=now() WHERE id=2;
SET ROLE authenticated;
SELECT public.expect_denied($s$SELECT public.set_rh_treatment('[{"type":"regular","id":"990"}]',true)$s$);
RESET ROLE;
