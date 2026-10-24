-- Prepared identities retain their numeric ID and privileges when Auth is created.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SELECT public.create_application_user('Prepared@Example.test','Prepared director','LONGCODE','director',1,true);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE email='prepared@example.test'
   AND auth_user_id IS NULL AND last_login_at IS NULL AND role='director' AND direction_id=1 AND is_rh) THEN
   RAISE EXCEPTION 'Prepared account missing or incorrect';
 END IF;
 BEGIN
   PERFORM public.create_application_user('PREPARED@example.test','Duplicate','','user',NULL,false);
   RAISE EXCEPTION 'Duplicate email accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END; $$;
SELECT id AS prepared_id FROM public.app_users WHERE email='prepared@example.test' \gset
RESET ROLE;
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000088','PREPARED@example.test');
SELECT (id = :prepared_id AND auth_user_id='00000000-0000-4000-8000-000000000088'
 AND role='director' AND direction_id=1 AND is_rh AND trigram='LONGCODE') AS claim_ok
 FROM public.app_users WHERE email='prepared@example.test' \gset
\if :claim_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'Auth did not preserve the prepared profile'; END; $$;
\endif
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$ BEGIN
 BEGIN
   PERFORM public.create_application_user('forbidden@example.test','Unauthorized','','user',NULL,false);
   RAISE EXCEPTION 'Ordinary user prepared an account';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
-- Departure is retained if Auth appears only after a prepared account was deleted.
UPDATE public.app_users SET deleted_at=now() WHERE email='prepared@example.test';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000088',false);
DO $$ BEGIN
 IF app_private.has_active_profile() THEN RAISE EXCEPTION 'Deleted prepared account gained access'; END IF;
END; $$;
RESET ROLE;

-- A prepared account removed before signup must remain disabled after claiming.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
SELECT public.create_application_user('removed-future@example.test','Departed future','','user',NULL,false);
UPDATE public.app_users SET deleted_at=now() WHERE email='removed-future@example.test';
RESET ROLE;
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000087','removed-future@example.test');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000087',false);
DO $$ BEGIN
 IF app_private.has_active_profile() THEN RAISE EXCEPTION 'Signup reactivated a removed prepared account'; END IF;
END; $$;
RESET ROLE;

-- A global save is atomic, even if it includes the current administrator's role.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$ DECLARE target_id bigint; admin_id bigint; BEGIN
 SELECT id INTO target_id FROM public.app_users WHERE email='user@example.test';
 SELECT id INTO admin_id FROM public.app_users WHERE email='admin@example.test';
 BEGIN
   PERFORM public.save_user_assignments(jsonb_build_array(
     jsonb_build_object('id',target_id,'role','director','direction_id',NULL,'is_rh',true),
     jsonb_build_object('id',admin_id,'role','user','direction_id',NULL,'is_rh',false)));
   RAISE EXCEPTION 'Invalid batch accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id=admin_id AND role='admin')
    OR NOT EXISTS (SELECT 1 FROM public.app_users WHERE id=target_id AND role='user' AND NOT is_rh) THEN
   RAISE EXCEPTION 'Failed batch was partially saved';
 END IF;
 PERFORM public.save_user_assignments(jsonb_build_array(
   jsonb_build_object('id',admin_id,'role','user','direction_id',NULL,'is_rh',false),
   jsonb_build_object('id',target_id,'role','director','direction_id',1,'is_rh',true)));
 IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id=target_id AND role='director' AND direction_id=1 AND is_rh) THEN
   RAISE EXCEPTION 'Batch save lost assignments after administrator demotion';
 END IF;
 BEGIN
   PERFORM public.save_user_assignments('[]');
   RAISE EXCEPTION 'Former administrator retained batch access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
