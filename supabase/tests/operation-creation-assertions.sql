SET ROLE authenticated;
DO $$ DECLARE actor record; table_name text; affected integer; BEGIN
 FOR actor IN SELECT auth_user_id, role FROM public.app_users LOOP
  PERFORM set_config('request.jwt.claim.sub', actor.auth_user_id::text, false);
  FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
   IF actor.role IN ('admin','initiator','director') THEN
    EXECUTE format('INSERT INTO public.%I (title) VALUES (%L)', table_name, 'Allowed creation');
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'Allowed creation refused'; END IF;
   ELSE
    PERFORM public.expect_denied(format('INSERT INTO public.%I (title) VALUES (%L)', table_name, 'Forbidden creation'));
    PERFORM public.expect_denied(format('TRUNCATE public.%I CASCADE', table_name));
   END IF;
  END LOOP;
 END LOOP;
END; $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
INSERT INTO public.regular_interventions (regular_period_id,comment) VALUES (1,'Allowed intervention');
INSERT INTO public.exceptional_on_call_interventions (on_call_id,comment) VALUES (1,'Allowed intervention');
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.expect_denied($s$INSERT INTO public.exceptional_works (title) VALUES ('No session')$s$);
RESET ROLE;
