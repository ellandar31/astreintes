BEGIN;

-- Roles come from the protected SQL profile, never from client-supplied metadata.
CREATE OR REPLACE FUNCTION app_private.can_edit_planning()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (SELECT 1 FROM public.app_users
 WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin','initiator','director'));
$$;
CREATE OR REPLACE FUNCTION app_private.owns_intervention(owner_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (SELECT 1 FROM public.app_users
 WHERE auth_user_id = (SELECT auth.uid()) AND id = owner_id AND role = 'user');
$$;
REVOKE ALL ON FUNCTION app_private.can_edit_planning(), app_private.owns_intervention(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.can_edit_planning(), app_private.owns_intervention(bigint) TO authenticated;

-- No-op parent writes remain necessary for the existing visa invalidation workflow.
-- Ordinary users cannot change ANY planning field, including ownership and RH status.
CREATE OR REPLACE FUNCTION app_private.guard_planning_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') THEN RETURN NEW; END IF;
 IF NOT app_private.can_edit_planning()
   AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
   RAISE EXCEPTION 'Planning is read-only for this profile' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.guard_planning_update() FROM PUBLIC, anon, authenticated;

DO $$ DECLARE table_name text; action text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON public.%I FROM PUBLIC, anon', table_name);
  EXECUTE format('DROP TRIGGER IF EXISTS protect_planning_update ON public.%I', table_name);
  EXECUTE format('CREATE TRIGGER protect_planning_update BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_planning_update()', table_name);
  EXECUTE format('DROP POLICY IF EXISTS planning_delete_roles ON public.%I', table_name);
  EXECUTE format('CREATE POLICY planning_delete_roles ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.can_edit_planning())', table_name);
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_call_participants','exceptional_work_participants'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM PUBLIC, anon', table_name);
  EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated', table_name);
  FOREACH action IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS participant_%s_roles ON public.%I', lower(action), table_name);
   IF action = 'INSERT' THEN
    EXECUTE format('CREATE POLICY participant_insert_roles ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_planning())', table_name);
   ELSIF action = 'UPDATE' THEN
    EXECUTE format('CREATE POLICY participant_update_roles ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (app_private.can_edit_planning()) WITH CHECK (app_private.can_edit_planning())', table_name);
   ELSE
    EXECUTE format('CREATE POLICY participant_delete_roles ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.can_edit_planning())', table_name);
   END IF;
  END LOOP;
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['regular_interventions','exceptional_on_call_interventions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM PUBLIC, anon', table_name);
  EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated', table_name);
  EXECUTE format('DROP POLICY IF EXISTS intervention_insert_owner ON public.%I', table_name);
  EXECUTE format('CREATE POLICY intervention_insert_owner ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_planning() OR app_private.owns_intervention(user_id))', table_name);
  EXECUTE format('DROP POLICY IF EXISTS intervention_update_owner ON public.%I', table_name);
  EXECUTE format('CREATE POLICY intervention_update_owner ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (app_private.can_edit_planning() OR app_private.owns_intervention(user_id)) WITH CHECK (app_private.can_edit_planning() OR app_private.owns_intervention(user_id))', table_name);
  EXECUTE format('DROP POLICY IF EXISTS intervention_delete_owner ON public.%I', table_name);
  EXECUTE format('CREATE POLICY intervention_delete_owner ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.can_edit_planning() OR app_private.owns_intervention(user_id))', table_name);
 END LOOP;
END; $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
