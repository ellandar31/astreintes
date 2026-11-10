-- Recent treatment is eligible; an operation without treatment is never eligible.
INSERT INTO public.regular_on_call_periods(id,user_id,starts_at,ends_at,treated_at)
 VALUES (9750,2,'2020-01-01','2020-01-02',now());
INSERT INTO public.regular_interventions(id,regular_period_id,user_id,starts_at,ends_at)
 VALUES (9750,9750,2,'2020-01-01','2020-01-02');
DO $$ BEGIN
 BEGIN
   UPDATE public.regular_on_call_periods SET user_id=3 WHERE id=9750;
   RAISE EXCEPTION 'Changing owner left interventions with a different user';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END; $$;
INSERT INTO public.exceptional_on_calls(id,title,treated_at) VALUES (9750,'Shared on-call',now());
INSERT INTO public.exceptional_on_call_participants(id,operation_id,participant_kind,user_id,starts_at,ends_at) VALUES
 (9750,9750,'planned',2,'2020-01-01','2020-01-02'),
 (9751,9750,'actual',2,'2020-01-01','2020-01-02'),
 (9752,9750,'actual',3,'2020-01-01','2020-01-02');
INSERT INTO public.exceptional_on_call_interventions(id,operation_id,user_id,starts_at,ends_at) VALUES
 (9750,9750,2,'2020-01-01','2020-01-02'), (9751,9750,3,'2020-01-01','2020-01-02');
INSERT INTO public.exceptional_on_call_visas(id,scope,participant_id) VALUES
 (9750,'exceptional_participant_agent',9751), (9751,'exceptional_participant_agent',9752);
INSERT INTO public.exceptional_on_call_visas(id,scope,operation_id) VALUES (9752,'exceptional_operation_director',9750);
INSERT INTO public.exceptional_works(id,title,treated_at) VALUES (9750,'Single participant',now()), (9751,'Not treated',NULL);
INSERT INTO public.exceptional_work_participants(id,operation_id,participant_kind,user_id,starts_at,ends_at) VALUES
 (9750,9750,'planned',2,'2020-01-01','2020-01-02'), (9751,9751,'actual',2,'2020-01-01','2020-01-02');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
 BEGIN PERFORM public.list_rh_user_purge_candidates(2); RAISE EXCEPTION 'Non-RH user preview accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.purge_rh_user_participations(2,'[]'); RAISE EXCEPTION 'Non-RH user purge accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
UPDATE public.app_users SET is_rh=true WHERE id=2;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$ DECLARE preview jsonb; BEGIN
 IF (SELECT count(*) FROM public.list_rh_user_purge_candidates(2))<>3 THEN RAISE EXCEPTION 'User purge eligibility incorrect'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.list_rh_user_purge_candidates(2) WHERE operation_type='exceptionalOnCall' AND NOT delete_operation) THEN
   RAISE EXCEPTION 'Shared operation marked for deletion';
 END IF;
 BEGIN
   PERFORM public.purge_rh_user_participations(2,jsonb_build_array(jsonb_build_object(
     'type','exceptionalOnCall','id',9750,'treatedAt',now(),'deleteOperation',true)));
   RAISE EXCEPTION 'Changed preview outcome accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT count(*) FROM public.list_rh_user_purge_candidates(2))<>3 THEN RAISE EXCEPTION 'Failed purge was partially applied'; END IF;
 SELECT jsonb_agg(jsonb_build_object('type',operation_type,'id',operation_id,'treatedAt',treated_at,'deleteOperation',delete_operation))
 INTO preview FROM public.list_rh_user_purge_candidates(2);
 IF public.purge_rh_user_participations(2,preview)<>3 THEN RAISE EXCEPTION 'User purge count incorrect'; END IF;
 IF EXISTS (SELECT 1 FROM public.list_rh_user_purge_candidates(2)) THEN RAISE EXCEPTION 'User still participates'; END IF;
END; $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.regular_on_call_periods WHERE id=9750)
   OR EXISTS (SELECT 1 FROM public.regular_interventions WHERE id=9750)
   OR EXISTS (SELECT 1 FROM public.exceptional_works WHERE id=9750) THEN RAISE EXCEPTION 'Empty operation retained'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.exceptional_works WHERE id=9751) THEN RAISE EXCEPTION 'Untreated operation removed'; END IF;
 IF EXISTS (SELECT 1 FROM public.exceptional_on_call_participants WHERE id IN (9750,9751))
   OR EXISTS (SELECT 1 FROM public.exceptional_on_call_interventions WHERE id=9750)
   OR EXISTS (SELECT 1 FROM public.exceptional_on_call_visas WHERE id=9750) THEN RAISE EXCEPTION 'Purged data retained'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.exceptional_on_calls WHERE id=9750 AND treated_at IS NOT NULL)
   OR NOT EXISTS (SELECT 1 FROM public.exceptional_on_call_participants WHERE id=9752)
   OR NOT EXISTS (SELECT 1 FROM public.exceptional_on_call_interventions WHERE id=9751)
   OR (SELECT count(*) FROM public.exceptional_on_call_visas WHERE id IN (9751,9752))<>2 THEN RAISE EXCEPTION 'Other participant data removed'; END IF;
END; $$;

-- Purging the last remaining user removes the entire shared operation.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$ DECLARE preview jsonb; BEGIN
 SELECT jsonb_agg(jsonb_build_object('type',operation_type,'id',operation_id,'treatedAt',treated_at,'deleteOperation',delete_operation))
 INTO preview FROM public.list_rh_user_purge_candidates(3);
 IF public.purge_rh_user_participations(3,preview)<>1 THEN RAISE EXCEPTION 'Last participant not purged'; END IF;
END; $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.exceptional_on_calls WHERE id=9750)
   OR EXISTS (SELECT 1 FROM public.exceptional_on_call_visas WHERE operation_id=9750) THEN
   RAISE EXCEPTION 'Operation or global visa retained after last participant';
 END IF;
END; $$;
