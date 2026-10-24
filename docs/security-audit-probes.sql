-- Diagnostic exclusivement destiné à une base de test isolée, après les trois scripts de supabase/database/
-- et les fixtures user-roles-bootstrap. Les succès ci-dessous reproduisent des
-- défauts ; ils ne constituent pas des tests de non-régression de sécurité.
BEGIN;
INSERT INTO public.regular_on_call_periods(id,user_id,starts_at,ends_at,sent_to_rh_at)
VALUES (501,2,'2026-10-10 08:00+02','2026-10-10 18:00+02',now());
INSERT INTO public.exceptional_on_calls(id,title,initiator_user_id,sent_to_rh_at)
VALUES (501,'Audit fictif',3,now());
INSERT INTO public.exceptional_works(id,title,initiator_user_id)
VALUES (501,'Audit fictif',3);
INSERT INTO public.rh_on_call_compensation_rules(code,label,coefficient)
VALUES ('audit-fixture','Coefficient fictif',1);
UPDATE public.app_users SET signature_drawing='signature-fictive-admin' WHERE id=1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
INSERT INTO public.visas(scope,regular_period_id,signed_by_user_id,signed_by_name,signed_at)
VALUES ('regular_period_director',501,4,'Directeur fictif',now());
INSERT INTO public.exceptional_on_call_visas(scope,operation_id,signed_by_user_id,signed_by_name,signed_at)
VALUES ('exceptional_operation_director',501,4,'Directeur fictif',now());
INSERT INTO public.exceptional_work_visas(scope,operation_id,signed_by_user_id,signed_by_name,signed_at)
VALUES ('exceptional_operation_director',501,4,'Directeur fictif',now());
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id=1 AND signature_drawing='signature-fictive-admin')
 THEN RAISE EXCEPTION 'Lecture tierce non reproduite'; END IF;
END; $$;
UPDATE public.rh_on_call_compensation_rules SET coefficient=999 WHERE code='audit-fixture';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.rh_on_call_compensation_rules WHERE code='audit-fixture' AND coefficient=999)
 THEN RAISE EXCEPTION 'Modification coefficient non reproduite'; END IF;
END; $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
UPDATE public.regular_on_call_periods SET sent_to_rh_at=NULL WHERE id=501;
UPDATE public.regular_on_call_periods SET ends_at='2026-10-10 19:00+02' WHERE id=501;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.regular_on_call_periods WHERE id=501 AND sent_to_rh_at IS NULL AND ends_at='2026-10-10 19:00+02')
 THEN RAISE EXCEPTION 'Déverrouillage régulier non reproduit'; END IF;
END; $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
UPDATE public.exceptional_on_calls SET sent_to_rh_at=NULL WHERE id=501;
UPDATE public.exceptional_on_calls SET title='Modifié après envoi RH' WHERE id=501;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.exceptional_on_calls WHERE id=501 AND sent_to_rh_at IS NULL AND title='Modifié après envoi RH')
 THEN RAISE EXCEPTION 'Déverrouillage exceptionnel non reproduit'; END IF;
END; $$;
RESET ROLE;
ROLLBACK;
