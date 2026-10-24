CREATE FUNCTION public.expect_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN insufficient_privilege THEN RETURN;
  END;
  RAISE EXCEPTION 'Expected permission denial: %', statement;
END;
$$;

-- Exercise all non-admin roles, not only the ordinary user's UI path.
SET ROLE authenticated;
DO $$
DECLARE actor record; affected integer; requested_role text;
BEGIN
 FOR actor IN SELECT auth_user_id, email, role FROM public.app_users WHERE role <> 'admin'
 LOOP
  PERFORM set_config('request.jwt.claim.sub', actor.auth_user_id::text, false);
  -- User-editable Auth metadata must never override the canonical role.
  PERFORM set_config('request.jwt.claims', '{"user_metadata":{"role":"admin"}}', false);
  UPDATE public.app_users SET display_name = 'Edited', signature_name = 'My signature', last_login_at = now()
   WHERE auth_user_id = actor.auth_user_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Own profile edit refused for %', actor.email; END IF;
  FOREACH requested_role IN ARRAY ARRAY['admin', 'user', 'initiator', 'director'] LOOP
   IF requested_role <> actor.role::text THEN
    PERFORM public.expect_denied(format('UPDATE public.app_users SET role = %L WHERE auth_user_id = %L', requested_role, actor.auth_user_id));
   END IF;
  END LOOP;
  PERFORM public.expect_denied(format('UPDATE public.app_users SET email = %L WHERE auth_user_id = %L', 'forged@example.test', actor.auth_user_id));
  PERFORM public.expect_denied(format('UPDATE public.app_users SET auth_user_id = %L WHERE auth_user_id = %L', '00000000-0000-4000-8000-000000000005', actor.auth_user_id));
  PERFORM public.expect_denied(format('UPDATE public.app_users SET id = 999 WHERE auth_user_id = %L', actor.auth_user_id));
  PERFORM public.expect_denied(format('UPDATE public.app_users SET created_at = now() + interval ''1 day'' WHERE auth_user_id = %L', actor.auth_user_id));
  UPDATE public.app_users SET display_name = 'Forged' WHERE email = 'admin@example.test';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Other profile update allowed'; END IF;
  DELETE FROM public.app_users;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Profile deletion allowed'; END IF;
  PERFORM public.expect_denied('TRUNCATE public.app_users CASCADE');
  PERFORM public.expect_denied('CREATE TABLE app_private.forged_roles (role text)');
 END LOOP;
END;
$$;
RESET ROLE;

-- Registration must not accept a role, identity or email chosen by the browser.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', false);
SELECT public.expect_denied($s$INSERT INTO public.app_users (auth_user_id,email,role)
 VALUES ('00000000-0000-4000-8000-000000000005','new@example.test','admin')$s$);
SELECT public.expect_denied($s$INSERT INTO public.app_users (auth_user_id,email)
 VALUES ('00000000-0000-4000-8000-000000000005','forged@example.test')$s$);
SELECT public.expect_denied($s$INSERT INTO public.app_users (auth_user_id,email)
 VALUES ('00000000-0000-4000-8000-000000000002','user@example.test')$s$);
INSERT INTO public.app_users (auth_user_id,email,display_name)
 VALUES ('00000000-0000-4000-8000-000000000005','new@example.test','New user');
SELECT public.expect_denied($s$INSERT INTO public.app_users (auth_user_id,email,role)
 VALUES ('00000000-0000-4000-8000-000000000005','new@example.test','admin')
 ON CONFLICT (auth_user_id) DO UPDATE SET role = excluded.role$s$);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE email = 'new@example.test' AND role = 'user') THEN
  RAISE EXCEPTION 'Registration did not default to user';
 END IF;
END; $$;
RESET ROLE;

-- Null session and anonymous access fail closed, even with a public anon key.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.expect_denied($s$INSERT INTO public.app_users (auth_user_id,email)
 VALUES ('00000000-0000-4000-8000-000000000005','new@example.test')$s$);
RESET ROLE;
SET ROLE anon;
SELECT public.expect_denied('SELECT * FROM public.app_users');
SELECT public.expect_denied('TRUNCATE public.app_users CASCADE');
RESET ROLE;

-- An administrator keeps CRUD and explicit role assignment on any profile.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
DO $$ DECLARE affected integer; BEGIN
 UPDATE public.app_users SET role = 'director', display_name = 'Admin edit' WHERE email = 'user@example.test';
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 1 THEN RAISE EXCEPTION 'Admin role assignment refused'; END IF;
 DELETE FROM public.app_users WHERE email = 'new@example.test';
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 1 THEN RAISE EXCEPTION 'Admin deletion refused'; END IF;
 INSERT INTO public.app_users (auth_user_id,email,role)
 VALUES ('00000000-0000-4000-8000-000000000005','new@example.test','initiator');
END; $$;
RESET ROLE;
