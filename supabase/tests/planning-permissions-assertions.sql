SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
DO $$ <<planning_permissions_assertions>> DECLARE table_name text; field_name text; owner_id bigint; other_id bigint; affected integer; BEGIN
 SELECT id INTO owner_id FROM public.app_users WHERE role = 'user';
 SELECT id INTO other_id FROM public.app_users WHERE role = 'initiator';
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  FOR field_name IN SELECT c.column_name FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = planning_permissions_assertions.table_name
     AND c.column_name IN ('starts_at','ends_at','planned_starts_at','planned_ends_at','actual_starts_at','actual_ends_at') LOOP
   PERFORM public.expect_denied(format('UPDATE public.%I SET %I = now() WHERE id = 1', table_name, field_name));
  END LOOP;
  -- No-op aggregate writes must still allow visa invalidation after an own intervention.
  EXECUTE format('UPDATE public.%I SET title = title WHERE id = 1', table_name);
  EXECUTE format('DELETE FROM public.%I WHERE id = 1', table_name);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'User deleted parent'; END IF;
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_call_participants','exceptional_work_participants'] LOOP
  PERFORM public.expect_denied(format('INSERT INTO public.%I (user_id) VALUES (%s)', table_name, owner_id));
  EXECUTE format('UPDATE public.%I SET starts_at = now()', table_name);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'User changed participants'; END IF;
  EXECUTE format('DELETE FROM public.%I', table_name);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'User deleted participants'; END IF;
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['regular_interventions','exceptional_on_call_interventions'] LOOP
  PERFORM public.expect_denied(format('INSERT INTO public.%I (%I,user_id) VALUES (1,%s)', table_name,
   CASE table_name WHEN 'regular_interventions' THEN 'regular_period_id' ELSE 'on_call_id' END, other_id));
  EXECUTE format('INSERT INTO public.%I (%I,user_id,comment) VALUES (1,%s,''Own creation'')', table_name,
   CASE table_name WHEN 'regular_interventions' THEN 'regular_period_id' ELSE 'on_call_id' END, owner_id);
  EXECUTE format('UPDATE public.%I SET starts_at = now() WHERE user_id = %s', table_name, owner_id);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 2 THEN RAISE EXCEPTION 'Own update refused'; END IF;
  EXECUTE format('UPDATE public.%I SET comment = ''Attack'' WHERE user_id = %s', table_name, other_id);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Foreign update allowed'; END IF;
  PERFORM public.expect_denied(format('UPDATE public.%I SET user_id = %s WHERE user_id = %s', table_name, other_id, owner_id));
  EXECUTE format('DELETE FROM public.%I WHERE user_id = %s', table_name, other_id);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Foreign delete allowed'; END IF;
  EXECUTE format('DELETE FROM public.%I WHERE user_id = %s', table_name, owner_id);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 2 THEN RAISE EXCEPTION 'Own deletion refused'; END IF;
 END LOOP;
END; $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
UPDATE public.regular_on_call_periods SET starts_at = now() WHERE id = 1;
UPDATE public.exceptional_on_calls SET planned_starts_at = now(), actual_starts_at = now() WHERE id = 1;
UPDATE public.exceptional_works SET planned_starts_at = now(), actual_starts_at = now() WHERE id = 1;
UPDATE public.exceptional_on_call_participants SET starts_at = now();
UPDATE public.exceptional_work_participants SET starts_at = now();
RESET ROLE;
