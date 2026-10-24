-- Validate installation of the complete application schema in an empty database.
INSERT INTO auth.users(id, email)
VALUES ('00000000-0000-4000-8000-000000000006', 'rh@example.test');
INSERT INTO public.app_users(auth_user_id, email, role)
VALUES ('00000000-0000-4000-8000-000000000006', 'rh@example.test', 'rh') ON CONFLICT (auth_user_id) DO UPDATE SET role = excluded.role;

DO $$ BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public') <> 18 THEN
    RAISE EXCEPTION 'Unexpected domain tables';
  END IF;
  -- Removed document exports must not reintroduce their obsolete configuration.
  IF to_regclass('public.rh_export_settings') IS NOT NULL
     OR to_regclass('public.rh_export_templates') IS NOT NULL THEN
    RAISE EXCEPTION 'Obsolete document export tables';
  END IF;
  -- Work compensation comes from actual participants, never a separate intervention table.
  IF to_regclass('public.exceptional_work_interventions') IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected work intervention table';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND NOT rowsecurity) THEN
    RAISE EXCEPTION 'Domain table without RLS';
  END IF;
END; $$;

INSERT INTO public.exceptional_on_calls(id, title, initiator_user_id)
VALUES (1, 'Astreinte', 3);
INSERT INTO public.exceptional_works(id, title, initiator_user_id)
VALUES (1, 'Travaux', 3);
INSERT INTO public.exceptional_on_call_participants(operation_id, participant_kind, user_id, starts_at, ends_at)
VALUES (1, 'actual', 2, '2026-10-10 08:00+02', '2026-10-10 18:00+02');
INSERT INTO public.exceptional_on_call_interventions(operation_id, user_id, starts_at, ends_at)
VALUES (1, 2, '2026-10-10 09:00+02', '2026-10-10 10:00+02');

DO $$ BEGIN
  BEGIN
    INSERT INTO public.exceptional_on_call_interventions(operation_id, user_id, starts_at, ends_at)
    VALUES (1, 2, '2026-10-10 19:00+02', '2026-10-10 20:00+02');
    RAISE EXCEPTION 'Out-of-period intervention accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Exceptional intervention must stay inside%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.exceptional_work_visas(scope, participant_id)
    SELECT 'exceptional_participant_agent', id FROM public.exceptional_on_call_participants;
    RAISE EXCEPTION 'Cross-family visa accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END; $$;

DO $$ BEGIN
  BEGIN
    INSERT INTO public.visas(scope) VALUES ('regular_period_agent');
    RAISE EXCEPTION 'Visa without a target accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END; $$;

SET LOCAL ROLE authenticated;
DO $$ DECLARE actor record; allowed boolean; BEGIN
  FOR actor IN SELECT * FROM public.app_users LOOP
    PERFORM set_config('request.jwt.claim.sub', actor.auth_user_id::text, true);
    allowed := actor.role IN ('admin', 'initiator', 'director', 'rh');
    IF app_private.can_create_operations() <> allowed
       OR app_private.can_edit_planning() <> allowed THEN
      RAISE EXCEPTION 'Wrong planning permissions for %', actor.role;
    END IF;
  END LOOP;
END; $$;
RESET ROLE;
