-- Purge eligibility follows treatment age rather than the operation period.
INSERT INTO public.regular_on_call_periods(id,user_id,starts_at,ends_at,treated_at) VALUES
 (9701,2,'2020-01-01','2020-01-02',now()-interval '3 years'),
 (9702,2,'2020-01-01','2020-01-02',now()-interval '3 years'),
 (9703,2,'2020-01-01','2020-01-02',now()-interval '6 months'),
 (9704,2,'2020-01-01','2020-01-02',NULL),
 (9705,2,'2020-01-01','2020-01-02',now()-interval '2 years');
INSERT INTO public.exceptional_on_calls(id,title,treated_at) VALUES (9701,'Old on-call',now()-interval '3 years');
INSERT INTO public.exceptional_works(id,title,treated_at) VALUES (9701,'Old work',now()-interval '3 years');
INSERT INTO public.regular_interventions(id,regular_period_id,user_id,starts_at,ends_at) VALUES (9701,9701,2,'2020-01-01','2020-01-02');
INSERT INTO public.visas(id,scope,regular_intervention_id) VALUES (9701,'regular_intervention_agent',9701);
INSERT INTO public.exceptional_on_call_participants(id,operation_id,participant_kind,user_id,starts_at,ends_at) VALUES (9701,9701,'actual',2,'2020-01-01','2020-01-02');
INSERT INTO public.exceptional_on_call_interventions(id,operation_id,user_id,starts_at,ends_at) VALUES (9701,9701,2,'2020-01-01','2020-01-02');
INSERT INTO public.exceptional_on_call_visas(id,scope,intervention_id) VALUES (9701,'exceptional_intervention_agent',9701);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
 BEGIN PERFORM public.list_rh_purge_candidates(2); RAISE EXCEPTION 'Non-RH preview accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.purge_rh_operations(2,'[]'); RAISE EXCEPTION 'Non-RH purge accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
UPDATE public.app_users SET is_rh=true WHERE id=2;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$ DECLARE preview jsonb; before_count integer; result integer; BEGIN
 IF (SELECT count(*) FROM public.list_rh_purge_candidates(2)) <> 4 THEN RAISE EXCEPTION 'Wrong two-year boundary'; END IF;
 IF (SELECT count(*) FROM public.list_rh_purge_candidates(1)) <> 5 THEN RAISE EXCEPTION 'Wrong one-year boundary'; END IF;
 BEGIN PERFORM public.list_rh_purge_candidates(0); RAISE EXCEPTION 'Invalid retention accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT jsonb_agg(jsonb_build_object('id',operation_id,'type',operation_type,'treatedAt',treated_at))
 INTO preview FROM public.list_rh_purge_candidates(2);
 -- A stale row invalidates the entire batch, including already processed entries.
 BEGIN
   PERFORM public.purge_rh_operations(2,preview || jsonb_build_array(jsonb_build_object(
     'id',9703,'type','regular','treatedAt',now()-interval '6 months')));
   RAISE EXCEPTION 'Recent treatment was purged';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT count(*) FROM public.list_rh_purge_candidates(2)) <> 4 THEN RAISE EXCEPTION 'Failed purge was partially applied'; END IF;
 BEGIN
   PERFORM public.purge_rh_operations(2,jsonb_build_array(jsonb_build_object(
     'id',9701,'type','regular','treatedAt',now()-interval '4 years')));
   RAISE EXCEPTION 'Changed treatment snapshot accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 result := public.purge_rh_operations(2,preview);
 IF result <> 4 THEN RAISE EXCEPTION 'Purge count incorrect'; END IF;
 IF EXISTS (SELECT 1 FROM public.regular_interventions WHERE id=9701)
   OR EXISTS (SELECT 1 FROM public.visas WHERE id=9701)
   OR EXISTS (SELECT 1 FROM public.exceptional_on_call_interventions WHERE id=9701)
   OR EXISTS (SELECT 1 FROM public.exceptional_on_call_visas WHERE id=9701) THEN
   RAISE EXCEPTION 'Purge left child data behind';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.regular_on_call_periods WHERE id=9703)
    OR NOT EXISTS (SELECT 1 FROM public.regular_on_call_periods WHERE id=9704)
    OR NOT EXISTS (SELECT 1 FROM public.regular_on_call_periods WHERE id=9705) THEN
   RAISE EXCEPTION 'Purge removed recent, untreated or boundary operations';
 END IF;
END; $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.purge_rh_operations(integer,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous purge access'; END IF;
END; $$;
