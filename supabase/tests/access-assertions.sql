-- Current full-schema permission checks, rolled back by the test runner.
CREATE FUNCTION public.expect_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
 RAISE EXCEPTION 'Expected permission denial: %', statement;
END; $$;
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test');
INSERT INTO public.app_users(auth_user_id,email,role) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test','rh');
INSERT INTO public.regular_on_call_periods(id,user_id,starts_at,ends_at) VALUES
 (701,2,'2026-10-10 08:00+02','2026-10-10 18:00+02'),
 (702,3,'2026-10-10 08:00+02','2026-10-10 18:00+02');
INSERT INTO public.regular_interventions(regular_period_id,user_id,starts_at,ends_at) VALUES
 (701,2,'2026-10-10 09:00+02','2026-10-10 10:00+02'),
 (702,3,'2026-10-10 09:00+02','2026-10-10 10:00+02');
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('INSERT INTO public.%I(id,title,initiator_user_id) VALUES (701,''Owned'',3),(702,''Foreign'',4)',table_name);
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_call_participants','exceptional_work_participants'] LOOP
  EXECUTE format('INSERT INTO public.%I(operation_id,participant_kind,user_id,starts_at,ends_at)
   SELECT o.id,''actual'',u.id,''2026-10-10 08:00+02''::timestamptz,''2026-10-10 18:00+02''::timestamptz
   FROM (VALUES (701),(702)) o(id) CROSS JOIN (VALUES (2),(3),(4)) u(id)',table_name);
 END LOOP;
END; $$;
INSERT INTO public.exceptional_on_call_interventions(operation_id,user_id,starts_at,ends_at) VALUES
 (701,2,'2026-10-10 09:00+02','2026-10-10 10:00+02'),
 (702,3,'2026-10-10 09:00+02','2026-10-10 10:00+02'),
 (702,4,'2026-10-10 09:00+02','2026-10-10 10:00+02');

SET LOCAL ROLE authenticated;
-- Exercise creation with complete rows, so domain constraints cannot hide access failures.
DO $$ DECLARE actor record; table_name text; new_id bigint; statement text; BEGIN
 FOR actor IN SELECT * FROM public.app_users LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
  FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
   IF table_name='regular_on_call_periods' THEN
    statement := format('INSERT INTO public.%I(user_id,starts_at,ends_at) VALUES (%s,''2026-10-11 08:00+02'',''2026-10-11 18:00+02'') RETURNING id',table_name,actor.id);
   ELSE
    statement := format('INSERT INTO public.%I(title,initiator_user_id) VALUES (''Creation'',%s) RETURNING id',table_name,actor.id);
   END IF;
   IF actor.role IN ('admin','initiator','director','rh') THEN
    EXECUTE statement INTO new_id;
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',table_name) USING new_id;
   ELSE
    PERFORM public.expect_denied(statement);
    PERFORM public.expect_denied(format('TRUNCATE public.%I CASCADE',table_name));
   END IF;
  END LOOP;
 END LOOP;
END; $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE table_name text; affected integer; BEGIN
 PERFORM public.expect_denied($s$UPDATE public.regular_on_call_periods SET starts_at=starts_at+interval '1 hour' WHERE id=701$s$);
 UPDATE public.regular_on_call_periods SET starts_at=starts_at WHERE id=701;
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_calls','exceptional_works'] LOOP
  PERFORM public.expect_denied(format('UPDATE public.%I SET title=''Forbidden'' WHERE id=701',table_name));
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('DELETE FROM public.%I WHERE id=701',table_name);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'User deleted parent'; END IF;
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_call_participants','exceptional_work_participants'] LOOP
  PERFORM public.expect_denied(format('INSERT INTO public.%I(operation_id,participant_kind,user_id) VALUES (701,''planned'',2)',table_name));
  EXECUTE format('UPDATE public.%I SET starts_at=starts_at+interval ''1 hour''',table_name);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'User edited participants'; END IF;
  EXECUTE format('DELETE FROM public.%I',table_name);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'User deleted participants'; END IF;
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['regular_interventions','exceptional_on_call_interventions'] LOOP
  EXECUTE format('UPDATE public.%I SET comment=''Own edit'' WHERE user_id=2',table_name);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Own intervention update denied'; END IF;
  EXECUTE format('UPDATE public.%I SET comment=''Foreign attack'' WHERE user_id=3',table_name);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Foreign intervention update accepted'; END IF;
  EXECUTE format('DELETE FROM public.%I WHERE user_id=3',table_name);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Foreign intervention deletion accepted'; END IF;
 END LOOP;
 PERFORM public.expect_denied($s$UPDATE public.regular_interventions SET regular_period_id=702,user_id=3 WHERE user_id=2$s$);
 PERFORM public.expect_denied($s$UPDATE public.exceptional_on_call_interventions SET user_id=3 WHERE user_id=2$s$);
END; $$;

-- Initiators can edit their aggregate and report their own interventions on foreign operations.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE table_name text; affected integer; BEGIN
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('UPDATE public.%I SET title=''Owned edit'' WHERE id=701',table_name);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Owned planning update denied'; END IF;
  PERFORM public.expect_denied(format('UPDATE public.%I SET title=''Foreign edit'' WHERE id=702',table_name));
  PERFORM public.expect_denied(format('UPDATE public.%I SET initiator_user_id=3 WHERE id=702',table_name));
 END LOOP;
 UPDATE public.exceptional_on_call_interventions SET comment='Own reporting' WHERE operation_id=702 AND user_id=3;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Own reporting on foreign operation denied'; END IF;
 UPDATE public.exceptional_on_call_interventions SET comment='Foreign attack' WHERE operation_id=702 AND user_id=4;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Foreign intervention update accepted'; END IF;
END; $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
DO $$ DECLARE table_name text; affected integer; BEGIN
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('UPDATE public.%I SET title=''RH edit'' WHERE id=702',table_name);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'RH transversal planning denied'; END IF;
 END LOOP;
 PERFORM public.expect_denied($s$UPDATE public.app_users SET role='admin' WHERE email='rh@example.test'$s$);
 DELETE FROM public.app_users;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'RH deleted profiles'; END IF;
END; $$;
RESET ROLE;
