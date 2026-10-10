BEGIN;

-- Les coefficients influencent les indemnités : la restriction SQL complète
-- le masquage du paramétrage dans l'interface, y compris pour les appels API directs.
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['rh_on_call_compensation_rules','rh_period_compensation_rules'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS compensation_admin_insert ON public.%I', table_name);
  EXECUTE format('DROP POLICY IF EXISTS compensation_admin_update ON public.%I', table_name);
  EXECUTE format('DROP POLICY IF EXISTS compensation_admin_delete ON public.%I', table_name);
  EXECUTE format('CREATE POLICY compensation_admin_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (app_private.is_application_admin())', table_name);
  EXECUTE format('CREATE POLICY compensation_admin_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (app_private.is_application_admin()) WITH CHECK (app_private.is_application_admin())', table_name);
  EXECUTE format('CREATE POLICY compensation_admin_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.is_application_admin())', table_name);
 END LOOP;
END; $$;

-- Le droit d'éditer le planning ne confère pas le droit d'envoyer ou de rouvrir
-- un dossier RH. Protéger aussi INSERT évite de créer un dossier déjà envoyé.
CREATE OR REPLACE FUNCTION app_private.guard_rh_send_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE status_changed boolean;
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') THEN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP = 'DELETE' THEN
  -- Supprimer puis recréer le même dossier ne doit pas annuler implicitement l'envoi.
  status_changed := OLD.sent_to_rh_at IS NOT NULL;
 ELSIF TG_OP = 'INSERT' THEN
  status_changed := NEW.sent_to_rh_at IS NOT NULL;
 ELSE
  status_changed := OLD.sent_to_rh_at IS DISTINCT FROM NEW.sent_to_rh_at;
 END IF;
 IF status_changed AND NOT EXISTS (
  SELECT 1 FROM public.app_users
  WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin','director','rh')
 ) THEN
  RAISE EXCEPTION 'RH send and cancellation require an admin, director or RH profile' USING ERRCODE = '42501';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app_private.guard_rh_send_transition() FROM PUBLIC, anon, authenticated;

DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS protect_rh_send_transition ON public.%I', table_name);
  EXECUTE format('CREATE TRIGGER protect_rh_send_transition BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_rh_send_transition()', table_name);
 END LOOP;
END; $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
