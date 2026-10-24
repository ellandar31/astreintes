CREATE FUNCTION public.expect_inactive_assignment(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM LIKE 'Un utilisateur ayant%' THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'Inactive assignment accepted: %', statement;
END; $$;

INSERT INTO public.regular_on_call_periods(id,user_id,starts_at,ends_at) VALUES (960,2,now(),now()+interval '1 hour');
INSERT INTO public.exceptional_on_calls(id,title,initiator_user_id,operation_manager_user_id) VALUES (960,'History',2,2);
INSERT INTO public.exceptional_works(id,title,initiator_user_id,operation_manager_user_id) VALUES (960,'History',2,2);
INSERT INTO public.exceptional_on_call_participants(id,operation_id,participant_kind,user_id,starts_at,ends_at)
 VALUES (960,960,'planned',2,now(),now()+interval '1 hour');
INSERT INTO public.exceptional_on_call_participants(id,operation_id,participant_kind,user_id,starts_at,ends_at)
 VALUES (961,960,'actual',2,now(),now()+interval '1 hour');
UPDATE public.app_users SET deleted_at='2099-01-01' WHERE id=2;

-- Existing references remain editable and readable after departure.
UPDATE public.regular_on_call_periods SET ends_at=now()+interval '2 hours' WHERE id=960;
UPDATE public.exceptional_on_calls SET title='Historic correction' WHERE id=960;
UPDATE public.exceptional_on_call_participants SET ends_at=now()+interval '2 hours' WHERE id=960;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.exceptional_on_call_participants WHERE id=960 AND user_id=2) THEN
  RAISE EXCEPTION 'Historical assignment disappeared';
 END IF;
END; $$;

SELECT public.expect_inactive_assignment($s$INSERT INTO public.regular_on_call_periods(user_id,starts_at,ends_at) VALUES (2,now(),now()+interval '1 hour')$s$);
SELECT public.expect_inactive_assignment($s$INSERT INTO public.regular_interventions(regular_period_id,user_id,starts_at,ends_at) VALUES (960,2,now(),now()+interval '1 hour')$s$);
SELECT public.expect_inactive_assignment($s$INSERT INTO public.exceptional_on_calls(title,initiator_user_id) VALUES ('New',2)$s$);
SELECT public.expect_inactive_assignment($s$INSERT INTO public.exceptional_works(title,operation_manager_user_id) VALUES ('New',2)$s$);
SELECT public.expect_inactive_assignment($s$INSERT INTO public.exceptional_on_call_participants(operation_id,participant_kind,user_id,starts_at,ends_at) VALUES (960,'actual',2,now(),now()+interval '1 hour')$s$);
SELECT public.expect_inactive_assignment($s$INSERT INTO public.exceptional_work_participants(operation_id,participant_kind,user_id,starts_at,ends_at) VALUES (960,'planned',2,now(),now()+interval '1 hour')$s$);
SELECT public.expect_inactive_assignment($s$INSERT INTO public.exceptional_on_call_interventions(operation_id,user_id,starts_at,ends_at) VALUES (960,2,now(),now()+interval '1 hour')$s$);
-- Moving an existing row to another participant zone is also a new assignment.
SELECT public.expect_inactive_assignment($s$UPDATE public.exceptional_on_call_participants SET participant_kind='actual' WHERE id=960$s$);
UPDATE public.exceptional_on_calls SET initiator_user_id=1 WHERE id=960;
SELECT public.expect_inactive_assignment($s$UPDATE public.exceptional_on_calls SET initiator_user_id=2 WHERE id=960$s$);
