-- Executed inside the disposable schema-test transaction, never against application data.
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test');
INSERT INTO public.app_users(auth_user_id,email,role) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test','rh');
INSERT INTO public.regular_on_call_periods(id,user_id,starts_at,ends_at)
VALUES (905,2,'2026-10-10 08:00+02','2026-10-10 18:00+02');
INSERT INTO public.regular_interventions(id,regular_period_id,user_id,starts_at,ends_at,ticket)
VALUES (905,905,2,'2026-10-10 09:00+02','2026-10-10 10:00+02','INC-123');
INSERT INTO public.exceptional_on_calls(id,title,initiator_user_id) VALUES (905,'Metadata test',3);
INSERT INTO public.exceptional_works(id,title,initiator_user_id) VALUES (905,'Metadata test',3);
INSERT INTO public.exceptional_on_call_participants(operation_id,participant_kind,user_id,starts_at,ends_at)
VALUES (905,'actual',2,'2026-10-10 08:00+02','2026-10-10 18:00+02');
INSERT INTO public.exceptional_on_call_interventions(id,operation_id,user_id,starts_at,ends_at,ticket)
VALUES (905,905,2,'2026-10-10 09:00+02','2026-10-10 10:00+02','EXT-456');

DO $$ DECLARE table_name text; stamp timestamptz; BEGIN
 IF (SELECT ticket FROM public.regular_interventions WHERE id=905) <> 'INC-123'
 OR (SELECT ticket FROM public.exceptional_on_call_interventions WHERE id=905) <> 'EXT-456' THEN
  RAISE EXCEPTION 'Ticket reference lost';
 END IF;
 UPDATE public.app_users SET trigram='ABC' WHERE id=2;
 BEGIN
  UPDATE public.app_users SET trigram='ABCD' WHERE id=2;
  RAISE EXCEPTION 'Overlong trigram accepted';
 EXCEPTION WHEN string_data_right_truncation THEN NULL;
 END;
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('SELECT treated_at FROM public.%I WHERE id=905',table_name) INTO stamp;
  IF stamp IS NOT NULL THEN RAISE EXCEPTION 'Treatment must default to NULL'; END IF;
 END LOOP;
END; $$;

SET LOCAL ROLE authenticated;
DO $$ DECLARE actor record; table_name text; BEGIN
 FOR actor IN SELECT * FROM public.app_users LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
  BEGIN
   UPDATE public.app_users SET deleted_at=now() WHERE id=actor.id;
   IF actor.role <> 'admin' THEN RAISE EXCEPTION 'Departure change accepted for %',actor.role; END IF;
   UPDATE public.app_users SET deleted_at=NULL WHERE id=actor.id;
  EXCEPTION WHEN insufficient_privilege THEN
   IF actor.role='admin' THEN RAISE; END IF;
  END;
  FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
   BEGIN
    EXECUTE format('UPDATE public.%I SET treated_at=now() WHERE id=905',table_name);
    IF actor.role NOT IN ('admin','director','rh') THEN RAISE EXCEPTION 'Treatment accepted for %',actor.role; END IF;
    EXECUTE format('UPDATE public.%I SET treated_at=NULL WHERE id=905',table_name);
   EXCEPTION WHEN insufficient_privilege THEN
    IF actor.role IN ('admin','director','rh') THEN RAISE; END IF;
   END;
  END LOOP;
 END LOOP;
END; $$;
RESET ROLE;
