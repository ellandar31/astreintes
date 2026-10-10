SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
DO $$ DECLARE table_name text; owner_id bigint; other_id bigint; affected integer; BEGIN
 SELECT id INTO owner_id FROM public.app_users WHERE role = 'initiator';
 SELECT id INTO other_id FROM public.app_users WHERE role = 'user';
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('UPDATE public.%I SET title = ''Owned update'' WHERE id = 1', table_name);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Initiator cannot edit owned operation'; END IF;
  PERFORM public.expect_denied(format('UPDATE public.%I SET title = ''Foreign update'' WHERE id = 2', table_name));
  PERFORM public.expect_denied(format('UPDATE public.%I SET initiator_user_id = %s WHERE id = 2', table_name, owner_id));
  EXECUTE format('DELETE FROM public.%I WHERE id = 2', table_name);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Initiator deleted foreign operation'; END IF;
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_call_participants','exceptional_work_participants'] LOOP
  EXECUTE format('INSERT INTO public.%I(operation_id,user_id) VALUES (1,%s)', table_name, other_id);
  PERFORM public.expect_denied(format('INSERT INTO public.%I(operation_id,user_id) VALUES (2,%s)', table_name, owner_id));
  EXECUTE format('UPDATE public.%I SET starts_at = now() WHERE operation_id = 2', table_name);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Initiator changed foreign planning'; END IF;
 END LOOP;
 INSERT INTO public.exceptional_on_call_interventions(operation_id,user_id,comment) VALUES (2,owner_id,'Own report');
 UPDATE public.exceptional_on_call_interventions SET comment = 'Own update' WHERE operation_id = 2 AND user_id = owner_id;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 2 THEN RAISE EXCEPTION 'Initiator cannot report own intervention'; END IF;
 UPDATE public.exceptional_on_call_interventions SET comment = 'Foreign attack' WHERE operation_id = 2 AND user_id = other_id;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Initiator edited foreign intervention'; END IF;
 PERFORM public.expect_denied(format('INSERT INTO public.exceptional_on_call_interventions(operation_id,user_id) VALUES (2,%s)',other_id));
END; $$;
