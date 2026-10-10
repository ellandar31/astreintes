INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test');
INSERT INTO public.app_users(auth_user_id,email,role) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test','rh');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
DO $$ DECLARE table_name text; affected integer; owner_id bigint; BEGIN
 SELECT id INTO owner_id FROM public.app_users WHERE role = 'user';
 IF NOT app_private.can_create_operations() OR NOT app_private.can_edit_planning() THEN
  RAISE EXCEPTION 'RH does not share director planning rights';
 END IF;
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('INSERT INTO public.%I(id,title) OVERRIDING SYSTEM VALUE VALUES (100,''RH creation'')',table_name);
  EXECUTE format('UPDATE public.%I SET title = ''RH edit'' WHERE id = 1',table_name);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'RH cannot edit foreign parent'; END IF;
  EXECUTE format('DELETE FROM public.%I WHERE id = 100',table_name);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'RH cannot delete parent'; END IF;
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_call_participants','exceptional_work_participants'] LOOP
  EXECUTE format('INSERT INTO public.%I(operation_id,user_id) VALUES (2,%s)',table_name,owner_id);
  EXECUTE format('UPDATE public.%I SET starts_at = now() WHERE operation_id = 2',table_name);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN RAISE EXCEPTION 'RH cannot edit foreign participants'; END IF;
 END LOOP;
 UPDATE public.exceptional_on_call_interventions SET comment = 'RH edit' WHERE operation_id = 2;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected = 0 THEN RAISE EXCEPTION 'RH cannot edit foreign interventions'; END IF;
 PERFORM public.expect_denied($s$UPDATE public.app_users SET role = 'admin' WHERE email = 'rh@example.test'$s$);
 UPDATE public.app_users SET role = 'rh' WHERE role = 'user';
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'RH can assign roles'; END IF;
 DELETE FROM public.app_users;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'RH can delete profiles'; END IF;
END; $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT public.expect_denied($s$UPDATE public.app_users SET role = 'rh' WHERE email = 'user@example.test'$s$);
-- Only an administrator can assign the new role.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.app_users SET role = 'rh' WHERE email = 'user@example.test';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE email = 'user@example.test' AND role = 'rh') THEN
  RAISE EXCEPTION 'Admin cannot assign RH';
 END IF;
END; $$;
