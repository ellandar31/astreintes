-- Directions are administration data; all authenticated profiles may read/filter them.
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test');
INSERT INTO public.app_users(auth_user_id,email,role,is_rh) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test','user',true) ON CONFLICT (auth_user_id) DO UPDATE SET role = excluded.role, is_rh = excluded.is_rh;
CREATE FUNCTION public.expect_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
 RAISE EXCEPTION 'Expected permission denial: %',statement;
END; $$;

-- Test-only defaults must not hide the actual NOT NULL requirements for operations.
ALTER TABLE public.regular_on_call_periods ALTER COLUMN direction_id DROP DEFAULT;
ALTER TABLE public.exceptional_on_calls ALTER COLUMN direction_id DROP DEFAULT;
ALTER TABLE public.exceptional_works ALTER COLUMN direction_id DROP DEFAULT;
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  BEGIN
   IF table_name='regular_on_call_periods' THEN
    EXECUTE format('INSERT INTO public.%I(user_id,starts_at,ends_at) VALUES (2,now(),now()+interval ''1 hour'')',table_name);
   ELSE EXECUTE format('INSERT INTO public.%I(title) VALUES (''Missing direction'')',table_name);
   END IF;
   RAISE EXCEPTION 'Missing operation direction accepted';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
 END LOOP;
 BEGIN
  UPDATE public.app_users SET direction_id=NULL WHERE role='initiator';
  RAISE EXCEPTION 'Initiator without direction accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.app_users SET direction_id=NULL WHERE role='director';
  RAISE EXCEPTION 'Director without direction accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  DELETE FROM public.directions WHERE id=1;
  RAISE EXCEPTION 'Referenced direction deleted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END; $$;

SET LOCAL ROLE authenticated;
DO $$ DECLARE actor record; affected integer; new_id bigint; BEGIN
 FOR actor IN SELECT * FROM public.app_users LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
  IF (SELECT count(*) FROM public.directions)<>2 THEN RAISE EXCEPTION 'Direction list unreadable'; END IF;
  IF actor.role='admin' THEN
   INSERT INTO public.directions(name) VALUES ('Direction créée') RETURNING id INTO new_id;
   UPDATE public.directions SET name='Direction modifiée' WHERE id=new_id;
   DELETE FROM public.directions WHERE id=new_id;
   GET DIAGNOSTICS affected=ROW_COUNT;
   IF affected<>1 THEN RAISE EXCEPTION 'Administrator direction CRUD denied'; END IF;
   UPDATE public.app_users SET direction_id=2 WHERE id=actor.id;
   UPDATE public.app_users SET direction_id=1 WHERE id=actor.id;
  ELSE
   PERFORM public.expect_denied('INSERT INTO public.directions(name) VALUES (''Forbidden'')');
   UPDATE public.directions SET name='Forbidden' WHERE id=2;
   GET DIAGNOSTICS affected=ROW_COUNT;
   IF affected<>0 THEN RAISE EXCEPTION 'Direction update accepted for %',actor.role; END IF;
   DELETE FROM public.directions WHERE id=2;
   GET DIAGNOSTICS affected=ROW_COUNT;
   IF affected<>0 THEN RAISE EXCEPTION 'Direction deletion accepted for %',actor.role; END IF;
   PERFORM public.expect_denied(format('UPDATE public.app_users SET direction_id=2 WHERE id=%s',actor.id));
  END IF;
 END LOOP;
END; $$;
RESET ROLE;

-- A direction reassignment is a planning change and cannot bypass the RH lock.
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  IF table_name='regular_on_call_periods' THEN
   EXECUTE format('INSERT INTO public.%I(id,direction_id,user_id,starts_at,ends_at,sent_to_rh_at) VALUES (940,1,2,now(),now()+interval ''1 hour'',now())',table_name);
  ELSE EXECUTE format('INSERT INTO public.%I(id,direction_id,title,sent_to_rh_at) VALUES (940,1,''RH locked'',now())',table_name);
  END IF;
  BEGIN
   EXECUTE format('UPDATE public.%I SET direction_id=2 WHERE id=940',table_name);
   RAISE EXCEPTION 'Direction change after RH send accepted';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%already sent to RH' THEN RAISE; END IF;
  END;
 END LOOP;
END; $$;
