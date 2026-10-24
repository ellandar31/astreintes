INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test');
INSERT INTO public.app_users(auth_user_id,email,role) VALUES ('00000000-0000-4000-8000-000000000006','rh@example.test','rh') ON CONFLICT (auth_user_id) DO UPDATE SET role = excluded.role;
-- Fixtures fictives : vérifier les permissions réelles du rôle utilisé par PostgREST.
INSERT INTO public.regular_on_call_periods(id,user_id,starts_at,ends_at)
VALUES (901,2,'2026-10-10 08:00+02','2026-10-10 18:00+02');
INSERT INTO public.exceptional_on_calls(id,title,initiator_user_id) VALUES (901,'Test RH',3);
INSERT INTO public.exceptional_works(id,title,initiator_user_id) VALUES (901,'Test RH',3);
INSERT INTO public.rh_on_call_compensation_rules(code,label,coefficient) VALUES ('security-test','Test',1);
INSERT INTO public.rh_period_compensation_rules(code,label,work_coefficient) VALUES ('security-test','Test',1);

SET LOCAL ROLE authenticated;
DO $$ DECLARE actor record; table_name text; field_name text; affected integer; stamp timestamptz := now(); BEGIN
 FOR actor IN SELECT * FROM public.app_users LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
  FOREACH table_name IN ARRAY ARRAY['rh_on_call_compensation_rules','rh_period_compensation_rules'] LOOP
   field_name := CASE table_name WHEN 'rh_on_call_compensation_rules' THEN 'coefficient' ELSE 'work_coefficient' END;
   -- Tous les profils gardent la lecture, sans acquérir le droit d'écriture.
   EXECUTE format('SELECT count(*) FROM public.%I WHERE code = %L',table_name,'security-test') INTO affected;
   IF affected <> 1 THEN RAISE EXCEPTION 'Coefficient read denied for %',actor.role; END IF;
   BEGIN
    EXECUTE format('INSERT INTO public.%I(code,label) VALUES (%L,%L)',table_name,'security-new','Test');
    IF actor.role <> 'admin' THEN RAISE EXCEPTION 'Coefficient insert accepted for %',actor.role; END IF;
   EXCEPTION WHEN insufficient_privilege THEN
    IF actor.role = 'admin' THEN RAISE; END IF;
   END;
   -- Le repository utilise UPSERT : ni une clé existante ni une nouvelle clé
   -- ne doivent permettre de contourner les politiques INSERT/UPDATE.
   BEGIN
    EXECUTE format('INSERT INTO public.%I(code,label,%I) VALUES (%L,%L,2) ON CONFLICT(code) DO UPDATE SET %I=2',table_name,field_name,'security-test','Test',field_name);
    IF actor.role <> 'admin' THEN RAISE EXCEPTION 'Coefficient upsert accepted for %',actor.role; END IF;
   EXCEPTION WHEN insufficient_privilege THEN
    IF actor.role = 'admin' THEN RAISE; END IF;
   END;
   EXECUTE format('UPDATE public.%I SET %I=999 WHERE code=%L',table_name,field_name,'security-test');
   GET DIAGNOSTICS affected = ROW_COUNT;
   IF affected <> (CASE WHEN actor.role = 'admin' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Wrong coefficient update rights for %',actor.role; END IF;
   EXECUTE format('DELETE FROM public.%I WHERE code=%L',table_name,CASE WHEN actor.role = 'admin' THEN 'security-new' ELSE 'security-test' END);
   GET DIAGNOSTICS affected = ROW_COUNT;
   IF affected <> (CASE WHEN actor.role = 'admin' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Wrong coefficient delete rights for %',actor.role; END IF;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
   BEGIN
    EXECUTE format('UPDATE public.%I SET sent_to_rh_at=$1 WHERE id=901',table_name) USING stamp;
    IF actor.role NOT IN ('admin','director','rh') THEN RAISE EXCEPTION 'RH send accepted for %',actor.role; END IF;
    EXECUTE format('UPDATE public.%I SET sent_to_rh_at=NULL WHERE id=901',table_name);
   EXCEPTION WHEN insufficient_privilege THEN
    IF actor.role IN ('admin','director','rh') THEN RAISE; END IF;
   END;
  END LOOP;
 END LOOP;
END; $$;
RESET ROLE;
-- L'initiateur doit pouvoir éditer ses dossiers ouverts, mais pas changer leur statut.
UPDATE public.regular_on_call_periods SET sent_to_rh_at=now() WHERE id=901;
UPDATE public.exceptional_on_calls SET sent_to_rh_at=now() WHERE id=901;
UPDATE public.exceptional_works SET sent_to_rh_at=now() WHERE id=901;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  BEGIN
   EXECUTE format('DELETE FROM public.%I WHERE id=901',table_name);
   RAISE EXCEPTION 'Initiator deletion of sent dossier accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
   EXECUTE format('UPDATE public.%I SET sent_to_rh_at=NULL WHERE id=901',table_name);
   RAISE EXCEPTION 'Initiator cancellation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
   EXECUTE format('UPDATE public.%I SET sent_to_rh_at=sent_to_rh_at+interval ''1 hour'' WHERE id=901',table_name);
   RAISE EXCEPTION 'Initiator RH timestamptz replacement accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
   IF table_name = 'regular_on_call_periods' THEN
    EXECUTE format('UPDATE public.%I SET sent_to_rh_at=NULL,ends_at=ends_at+interval ''1 hour'' WHERE id=901',table_name);
   ELSE
    EXECUTE format('UPDATE public.%I SET sent_to_rh_at=NULL,title=''Atomic bypass'' WHERE id=901',table_name);
   END IF;
   RAISE EXCEPTION 'Atomic RH bypass accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
   IF table_name = 'regular_on_call_periods' THEN
    EXECUTE format('INSERT INTO public.%I(user_id,starts_at,ends_at,sent_to_rh_at) VALUES (2,now(),now()+interval ''1 hour'',now())',table_name);
   ELSE
    EXECUTE format('INSERT INTO public.%I(title,initiator_user_id,sent_to_rh_at) VALUES (''Sent bypass'',3,now())',table_name);
   END IF;
   RAISE EXCEPTION 'Already-sent insert accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
END; $$;
RESET ROLE;
UPDATE public.exceptional_on_calls SET sent_to_rh_at=NULL WHERE id=901;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
UPDATE public.exceptional_on_calls SET title='Legitimate planning edit' WHERE id=901;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.exceptional_on_calls WHERE id=901 AND title='Legitimate planning edit') THEN
  RAISE EXCEPTION 'Initiator planning edit denied';
 END IF;
END; $$;
RESET ROLE;
-- La suppression d'un dossier ouvert reste une opération de planning autorisée.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DELETE FROM public.exceptional_on_calls WHERE id=901;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.exceptional_on_calls WHERE id=901) THEN RAISE EXCEPTION 'Open dossier deletion denied'; END IF;
END; $$;
-- Les profils habilités conservent aussi la suppression de dossiers envoyés.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
DELETE FROM public.exceptional_works WHERE id=901;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.exceptional_works WHERE id=901) THEN RAISE EXCEPTION 'Director sent dossier deletion denied'; END IF;
END; $$;
RESET ROLE;
