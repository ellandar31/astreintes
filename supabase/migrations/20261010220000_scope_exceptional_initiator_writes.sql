BEGIN;

-- SECURITY DEFINER avoids recursive RLS between a parent and its participants.
-- The caller identity always comes from the protected SQL profile.
CREATE OR REPLACE FUNCTION app_private.can_access_exceptional(family text, operation bigint, editing boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.app_users u
  WHERE u.auth_user_id = (SELECT auth.uid()) AND (
   u.role IN ('admin', 'director') OR EXISTS (
    SELECT 1 FROM public.exceptional_on_calls o WHERE family = 'astreinte' AND o.id = operation
     AND ((u.role = 'initiator' AND o.initiator_user_id = u.id)
      OR (NOT editing AND EXISTS (SELECT 1 FROM public.exceptional_on_call_participants p WHERE p.operation_id = o.id AND p.user_id = u.id)))
    UNION ALL
    SELECT 1 FROM public.exceptional_works o WHERE family = 'travaux' AND o.id = operation
     AND ((u.role = 'initiator' AND o.initiator_user_id = u.id)
      OR (NOT editing AND EXISTS (SELECT 1 FROM public.exceptional_work_participants p WHERE p.operation_id = o.id AND p.user_id = u.id)))
   )
  )
 );
$$;
CREATE OR REPLACE FUNCTION app_private.is_exceptional_intervention_owner(owner_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.app_users WHERE auth_user_id = (SELECT auth.uid())
 AND id = owner_id AND role IN ('user', 'initiator')); $$;
REVOKE ALL ON FUNCTION app_private.can_access_exceptional(text,bigint,boolean), app_private.is_exceptional_intervention_owner(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.can_access_exceptional(text,bigint,boolean), app_private.is_exceptional_intervention_owner(bigint) TO authenticated;

-- Check the persisted OLD owner. Changing the submitted owner cannot grant edit rights.
-- Preserve no-op updates used by intervention and visa workflows.
CREATE OR REPLACE FUNCTION app_private.guard_exceptional_initiator_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') THEN RETURN NEW; END IF;
 IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at')
 AND NOT app_private.can_access_exceptional(TG_ARGV[0], OLD.id, true) THEN
  RAISE EXCEPTION 'Only the operation initiator can edit this planning' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.guard_exceptional_initiator_update() FROM PUBLIC, anon, authenticated;

DO $$ DECLARE family text; parent_table text; child_table text; BEGIN
 FOREACH family IN ARRAY ARRAY['astreinte','travaux'] LOOP
  parent_table := CASE family WHEN 'astreinte' THEN 'exceptional_on_calls' ELSE 'exceptional_works' END;
  EXECUTE format('DROP TRIGGER IF EXISTS protect_exceptional_initiator ON public.%I', parent_table);
  EXECUTE format('CREATE TRIGGER protect_exceptional_initiator BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_exceptional_initiator_update(%L)', parent_table, family);
  EXECUTE format('DROP POLICY IF EXISTS exceptional_initiator_delete ON public.%I', parent_table);
  EXECUTE format('CREATE POLICY exceptional_initiator_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.can_access_exceptional(%L,id,true))', parent_table, family);
  -- Keep existing SELECT policies: the application filters lists, while this migration
  -- protects writes without changing RH reads or the creation/RETURNING workflow.
  child_table := CASE family WHEN 'astreinte' THEN 'exceptional_on_call_participants' ELSE 'exceptional_work_participants' END;
  EXECUTE format('DROP POLICY IF EXISTS exceptional_initiator_insert ON public.%I', child_table);
  EXECUTE format('CREATE POLICY exceptional_initiator_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_access_exceptional(%L,operation_id,true))', child_table, family);
  EXECUTE format('DROP POLICY IF EXISTS exceptional_initiator_update ON public.%I', child_table);
  EXECUTE format('CREATE POLICY exceptional_initiator_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (app_private.can_access_exceptional(%L,operation_id,true)) WITH CHECK (app_private.can_access_exceptional(%L,operation_id,true))', child_table, family, family);
  EXECUTE format('DROP POLICY IF EXISTS exceptional_initiator_delete ON public.%I', child_table);
  EXECUTE format('CREATE POLICY exceptional_initiator_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.can_access_exceptional(%L,operation_id,true))', child_table, family);
 END LOOP;
END; $$;

DROP POLICY IF EXISTS exceptional_initiator_insert ON public.exceptional_on_call_interventions;
CREATE POLICY exceptional_initiator_insert ON public.exceptional_on_call_interventions AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (app_private.can_access_exceptional('astreinte',operation_id,true) OR app_private.is_exceptional_intervention_owner(user_id));
DROP POLICY IF EXISTS exceptional_initiator_update ON public.exceptional_on_call_interventions;
CREATE POLICY exceptional_initiator_update ON public.exceptional_on_call_interventions AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (app_private.can_access_exceptional('astreinte',operation_id,true) OR app_private.is_exceptional_intervention_owner(user_id))
 WITH CHECK (app_private.can_access_exceptional('astreinte',operation_id,true) OR app_private.is_exceptional_intervention_owner(user_id));
DROP POLICY IF EXISTS exceptional_initiator_delete ON public.exceptional_on_call_interventions;
CREATE POLICY exceptional_initiator_delete ON public.exceptional_on_call_interventions AS RESTRICTIVE FOR DELETE TO authenticated
 USING (app_private.can_access_exceptional('astreinte',operation_id,true) OR app_private.is_exceptional_intervention_owner(user_id));
NOTIFY pgrst, 'reload schema';
COMMIT;
