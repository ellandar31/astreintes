CREATE FUNCTION public.expect_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  EXECUTE statement;
 EXCEPTION WHEN insufficient_privilege THEN RETURN;
 END;
 RAISE EXCEPTION 'Expected permission denial: %', statement;
END;
$$;

-- Account provisioning happens once, independently of browser login.
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000009','departed@example.test');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE auth_user_id = '00000000-0000-4000-8000-000000000009' AND role = 'user') THEN
  RAISE EXCEPTION 'Signup did not provision an ordinary application profile';
 END IF;
END; $$;
-- Any populated date disables access, including a future date.
UPDATE public.app_users SET deleted_at = '2099-01-01' WHERE email = 'departed@example.test';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',false);
DO $$ DECLARE t text; visible bigint; affected integer; BEGIN
 IF app_private.has_active_profile() THEN RAISE EXCEPTION 'Departed profile remains active'; END IF;
 FOR t IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO visible;
  IF visible <> 0 THEN RAISE EXCEPTION 'Departed profile can read %',t; END IF;
 END LOOP;
 UPDATE public.app_users SET deleted_at = NULL WHERE auth_user_id = auth.uid();
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Departed profile restored itself'; END IF;
END; $$;
SELECT public.expect_denied($s$INSERT INTO public.app_users(auth_user_id,email)
 VALUES ('00000000-0000-4000-8000-000000000009','departed@example.test')$s$);
RESET ROLE;
-- Even a privileged role cannot bypass the live-profile gate after departure.
UPDATE public.app_users SET role = 'admin' WHERE email = 'departed@example.test';
SET ROLE authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.directions) THEN RAISE EXCEPTION 'Departed administrator retains access'; END IF;
END; $$;
RESET ROLE;
-- A physically removed profile must not be recreated with a still-valid JWT.
DELETE FROM public.app_users WHERE email = 'departed@example.test';
SET ROLE authenticated;
DO $$ BEGIN
 IF app_private.has_active_profile() THEN RAISE EXCEPTION 'Removed profile remains active'; END IF;
 IF EXISTS (SELECT 1 FROM public.directions) THEN RAISE EXCEPTION 'Removed profile can read domain data'; END IF;
END; $$;
SELECT public.expect_denied($s$INSERT INTO public.app_users(auth_user_id,email)
 VALUES ('00000000-0000-4000-8000-000000000009','departed@example.test')$s$);
RESET ROLE;
