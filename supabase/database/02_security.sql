-- Sécurisation des accès Astreintes.
-- Exécuter après 01_structure.sql, avec le rôle postgres. Réexécutable.
-- Supabase fournit auth.users, auth.uid() et les rôles anon/authenticated/service_role.
BEGIN;
SET LOCAL search_path = '';

-- Independent export permission: existing profiles stay unflagged until explicitly assigned.
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS is_rh boolean NOT NULL DEFAULT false;
-- Beta upgrade: the former RH role becomes an ordinary user with export access.
-- Keep an existing enum label unused rather than rebuilding types and dependent objects.
UPDATE public.app_users SET role = 'user', is_rh = true WHERE role::text = 'rh';

-- Replace only this application's policies/triggers so the access script is safely repeatable.
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT tablename, policyname FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND policyname = ANY(ARRAY['authenticated_access','compensation_admin_delete','compensation_admin_insert','compensation_admin_update','exceptional_initiator_delete','exceptional_initiator_insert','exceptional_initiator_update','intervention_delete_owner','intervention_insert_owner','intervention_update_owner','operation_creation_roles','participant_delete_roles','participant_insert_roles','participant_update_roles','planning_delete_roles','profiles_delete','profiles_insert','profiles_read','profiles_update']) LOOP
  EXECUTE format('DROP POLICY %I ON public.%I', item.policyname, item.tablename);
 END LOOP;
 FOR item IN SELECT t.tgname, c.relname FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname = ANY(ARRAY['guard_user_profile','protect_exceptional_initiator','protect_planning_update','protect_rh_send_transition','protect_rh_treatment_transition','protect_user_departure']) LOOP
  EXECUTE format('DROP TRIGGER %I ON public.%I', item.tgname, item.relname);
 END LOOP;
END; $$;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exceptional_on_calls ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exceptional_works ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.regular_interventions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.regular_on_call_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rh_on_call_compensation_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rh_period_compensation_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.schedule_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.visas ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

DO $$ DECLARE t text; BEGIN
    FOR t IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
        IF t <> 'app_users' THEN
            EXECUTE format('CREATE POLICY authenticated_access ON public.%I TO authenticated USING (true) WITH CHECK (true)', t);
        END IF;
    END LOOP;
END; $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE OR REPLACE FUNCTION app_private.can_create_operations()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.app_users
 WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin','initiator','director'));
$$;

CREATE OR REPLACE FUNCTION app_private.can_edit_planning()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.app_users
 WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin','initiator','director'));
$$;

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

CREATE OR REPLACE FUNCTION app_private.is_application_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE auth_user_id = (SELECT auth.uid()) AND role = 'admin'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION app_private.is_application_admin() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_private.is_application_admin() TO authenticated;

CREATE OR REPLACE FUNCTION app_private.session_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT email FROM auth.users WHERE id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION app_private.session_email() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_private.session_email() TO authenticated;

CREATE OR REPLACE FUNCTION app_private.guard_user_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.role::text = 'rh' THEN
    RAISE EXCEPTION 'RH is an independent permission, not a base role' USING ERRCODE = '23514';
  END IF;
  -- Trusted maintenance and server credentials are not browser identities.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF app_private.is_application_admin() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR NEW.auth_user_id IS DISTINCT FROM auth.uid()
     OR NEW.email IS DISTINCT FROM app_private.session_email() THEN
    RAISE EXCEPTION 'Profile identity must match the authenticated account' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'user'::public.user_role OR NEW.direction_id IS NOT NULL OR NEW.is_rh THEN
      RAISE EXCEPTION 'Only an administrator can assign roles' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
       OR NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.direction_id IS DISTINCT FROM OLD.direction_id
       OR NEW.is_rh IS DISTINCT FROM OLD.is_rh THEN
      RAISE EXCEPTION 'Only an administrator can change profile privileges or identity' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.guard_user_profile() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_user_profile BEFORE INSERT OR UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION app_private.guard_user_profile();

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_users FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_users TO authenticated;

REVOKE ALL ON SEQUENCE public.app_users_id_seq FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SEQUENCE public.app_users_id_seq TO authenticated;

CREATE POLICY profiles_read ON public.app_users FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_insert ON public.app_users FOR INSERT TO authenticated
  WITH CHECK (app_private.is_application_admin());

CREATE POLICY profiles_update ON public.app_users FOR UPDATE TO authenticated
  USING (app_private.is_application_admin() OR auth_user_id = (SELECT auth.uid()))
  WITH CHECK (app_private.is_application_admin() OR auth_user_id = (SELECT auth.uid()));

CREATE POLICY profiles_delete ON public.app_users FOR DELETE TO authenticated
  USING (app_private.is_application_admin());

REVOKE ALL ON FUNCTION app_private.can_create_operations() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_private.can_create_operations() TO authenticated;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods', 'exceptional_on_calls', 'exceptional_works']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE INSERT ON public.%I FROM PUBLIC, anon', table_name);
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT INSERT ON public.%I TO authenticated', table_name);

    -- Restrictive policies combine with the base access policy using AND.
    EXECUTE format('CREATE POLICY operation_creation_roles ON public.%I AS RESTRICTIVE
      FOR INSERT TO authenticated WITH CHECK (app_private.can_create_operations())', table_name);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.owns_intervention(owner_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (SELECT 1 FROM public.app_users
 WHERE auth_user_id = (SELECT auth.uid()) AND id = owner_id AND role = 'user');
$$;

REVOKE ALL ON FUNCTION app_private.can_edit_planning(), app_private.owns_intervention(bigint) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_private.can_edit_planning(), app_private.owns_intervention(bigint) TO authenticated;

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

  EXECUTE format('CREATE TRIGGER protect_planning_update BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_planning_update()', table_name);

  EXECUTE format('CREATE POLICY planning_delete_roles ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.can_edit_planning())', table_name);
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_call_participants','exceptional_work_participants'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM PUBLIC, anon', table_name);
  EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated', table_name);
  FOREACH action IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP

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

  EXECUTE format('CREATE POLICY intervention_insert_owner ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_edit_planning() OR app_private.owns_intervention(user_id))', table_name);

  EXECUTE format('CREATE POLICY intervention_update_owner ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (app_private.can_edit_planning() OR app_private.owns_intervention(user_id)) WITH CHECK (app_private.can_edit_planning() OR app_private.owns_intervention(user_id))', table_name);

  EXECUTE format('CREATE POLICY intervention_delete_owner ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.can_edit_planning() OR app_private.owns_intervention(user_id))', table_name);
 END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION app_private.is_exceptional_intervention_owner(owner_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.app_users WHERE auth_user_id = (SELECT auth.uid())
 AND id = owner_id AND role IN ('user', 'initiator')); $$;

REVOKE ALL ON FUNCTION app_private.can_access_exceptional(text,bigint,boolean), app_private.is_exceptional_intervention_owner(bigint) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_private.can_access_exceptional(text,bigint,boolean), app_private.is_exceptional_intervention_owner(bigint) TO authenticated;

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

  EXECUTE format('CREATE TRIGGER protect_exceptional_initiator BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_exceptional_initiator_update(%L)', parent_table, family);

  EXECUTE format('CREATE POLICY exceptional_initiator_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.can_access_exceptional(%L,id,true))', parent_table, family);
  -- Directory reads support RH lists and INSERT RETURNING; ownership checks protect writes.
  child_table := CASE family WHEN 'astreinte' THEN 'exceptional_on_call_participants' ELSE 'exceptional_work_participants' END;

  EXECUTE format('CREATE POLICY exceptional_initiator_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (app_private.can_access_exceptional(%L,operation_id,true))', child_table, family);

  EXECUTE format('CREATE POLICY exceptional_initiator_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (app_private.can_access_exceptional(%L,operation_id,true)) WITH CHECK (app_private.can_access_exceptional(%L,operation_id,true))', child_table, family, family);

  EXECUTE format('CREATE POLICY exceptional_initiator_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (app_private.can_access_exceptional(%L,operation_id,true))', child_table, family);
 END LOOP;
END; $$;

CREATE POLICY exceptional_initiator_insert ON public.exceptional_on_call_interventions AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (app_private.can_access_exceptional('astreinte',operation_id,true) OR app_private.is_exceptional_intervention_owner(user_id));

CREATE POLICY exceptional_initiator_update ON public.exceptional_on_call_interventions AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (app_private.can_access_exceptional('astreinte',operation_id,true) OR app_private.is_exceptional_intervention_owner(user_id))
 WITH CHECK (app_private.can_access_exceptional('astreinte',operation_id,true) OR app_private.is_exceptional_intervention_owner(user_id));

CREATE POLICY exceptional_initiator_delete ON public.exceptional_on_call_interventions AS RESTRICTIVE FOR DELETE TO authenticated
 USING (app_private.can_access_exceptional('astreinte',operation_id,true) OR app_private.is_exceptional_intervention_owner(user_id));

REVOKE ALL ON FUNCTION app_private.can_create_operations(), app_private.can_edit_planning(), app_private.can_access_exceptional(text,bigint,boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_private.can_create_operations(), app_private.can_edit_planning(), app_private.can_access_exceptional(text,bigint,boolean) TO authenticated;

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
  WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin','director')
 ) THEN
  RAISE EXCEPTION 'RH send and cancellation require an admin or director profile' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION app_private.guard_user_departure()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE changed boolean;
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') THEN RETURN NEW; END IF;
 IF TG_OP = 'INSERT' THEN changed := NEW.deleted_at IS NOT NULL;
 ELSE changed := OLD.deleted_at IS DISTINCT FROM NEW.deleted_at;
 END IF;
 IF changed AND NOT app_private.is_application_admin() THEN
  RAISE EXCEPTION 'Only an administrator can change a user departure date' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION app_private.guard_user_departure() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_user_departure ON public.app_users;

CREATE TRIGGER protect_user_departure BEFORE INSERT OR UPDATE ON public.app_users
 FOR EACH ROW EXECUTE FUNCTION app_private.guard_user_departure();

CREATE OR REPLACE FUNCTION app_private.guard_rh_treatment_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE changed boolean;
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') THEN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP = 'DELETE' THEN changed := OLD.treated_at IS NOT NULL;
 ELSIF TG_OP = 'INSERT' THEN changed := NEW.treated_at IS NOT NULL;
 ELSE changed := OLD.treated_at IS DISTINCT FROM NEW.treated_at;
 END IF;
 IF changed AND NOT EXISTS (
  SELECT 1 FROM public.app_users
  WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin','director')
 ) THEN
  RAISE EXCEPTION 'RH treatment requires an admin or director profile' USING ERRCODE = '42501';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION app_private.guard_rh_treatment_transition() FROM PUBLIC, anon, authenticated;

DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('CREATE TRIGGER protect_rh_treatment_transition BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_rh_treatment_transition()', table_name);
 END LOOP;
END; $$;

-- Everyone authenticated can read the reference; only admins manage it.
DROP POLICY IF EXISTS directions_admin_insert ON public.directions;
DROP POLICY IF EXISTS directions_admin_update ON public.directions;
DROP POLICY IF EXISTS directions_admin_delete ON public.directions;
CREATE POLICY directions_admin_insert ON public.directions AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (app_private.is_application_admin());
CREATE POLICY directions_admin_update ON public.directions AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (app_private.is_application_admin()) WITH CHECK (app_private.is_application_admin());
CREATE POLICY directions_admin_delete ON public.directions AS RESTRICTIVE FOR DELETE TO authenticated
 USING (app_private.is_application_admin());


-- Authentication tokens outlive profile removal. Every table therefore checks the
-- live application profile, independently of token expiry and browser logout.
CREATE OR REPLACE FUNCTION app_private.has_active_profile()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.app_users
 WHERE auth_user_id = (SELECT auth.uid()) AND deleted_at IS NULL);
$$;
REVOKE ALL ON FUNCTION app_private.has_active_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_active_profile() TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' LOOP
  EXECUTE format('DROP POLICY IF EXISTS active_profile_required ON public.%I', t);
  EXECUTE format('CREATE POLICY active_profile_required ON public.%I AS RESTRICTIVE TO authenticated USING (app_private.has_active_profile()) WITH CHECK (app_private.has_active_profile())', t);
 END LOOP;
END; $$;

-- Provision once when Auth creates the identity. Login cannot resurrect a deleted
-- profile; only an administrator can explicitly restore application access.
CREATE OR REPLACE FUNCTION app_private.provision_application_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.app_users(auth_user_id, email, role)
 VALUES (NEW.id, coalesce(NEW.email, ''), 'user');
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.provision_application_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS provision_application_user ON auth.users;
CREATE TRIGGER provision_application_user AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION app_private.provision_application_user();

-- Preserve historical assignments, but validate every new identity or transfer.
-- The row lock serializes an assignment with a concurrent departure update.
CREATE OR REPLACE FUNCTION app_private.guard_active_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE column_name text; assigned_id bigint; previous jsonb := '{}'::jsonb;
BEGIN
 IF TG_OP = 'UPDATE' THEN previous := to_jsonb(OLD); END IF;
 FOREACH column_name IN ARRAY TG_ARGV LOOP
  assigned_id := (to_jsonb(NEW)->>column_name)::bigint;
  IF assigned_id IS NULL THEN CONTINUE; END IF;
  IF TG_OP = 'UPDATE' AND previous->column_name = to_jsonb(NEW)->column_name
   AND previous->'operation_id' IS NOT DISTINCT FROM to_jsonb(NEW)->'operation_id'
   AND previous->'regular_period_id' IS NOT DISTINCT FROM to_jsonb(NEW)->'regular_period_id'
   AND previous->'participant_kind' IS NOT DISTINCT FROM to_jsonb(NEW)->'participant_kind' THEN
   CONTINUE;
  END IF;
  PERFORM id FROM public.app_users WHERE id = assigned_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Un utilisateur ayant une date de départ ne peut plus être affecté à une opération.' USING ERRCODE = '23514';
  END IF;
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.guard_active_assignment() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['regular_on_call_periods','regular_interventions','exceptional_on_call_participants','exceptional_work_participants','exceptional_on_call_interventions'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS guard_active_assignment ON public.%I', t);
  EXECUTE format('CREATE TRIGGER guard_active_assignment BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_active_assignment(''user_id'')', t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['exceptional_on_calls','exceptional_works'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS guard_active_assignment ON public.%I', t);
  EXECUTE format('CREATE TRIGGER guard_active_assignment BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_active_assignment(''initiator_user_id'', ''operation_manager_user_id'')', t);
 END LOOP;
END; $$;

-- Dedicated RH command: grants treatment only, without granting planning or visa rights.
CREATE OR REPLACE FUNCTION public.set_rh_treatment(operations jsonb, treated boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item jsonb; target_table text; operation_id bigint; submitted timestamptz;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE auth_user_id = (SELECT auth.uid())
   AND deleted_at IS NULL AND is_rh) THEN
  RAISE EXCEPTION 'RH access required' USING ERRCODE = '42501';
 END IF;
 IF treated IS NULL OR jsonb_typeof(operations) IS DISTINCT FROM 'array' OR jsonb_array_length(operations) = 0 THEN
  RAISE EXCEPTION 'Select operations and a treatment status' USING ERRCODE = '22023';
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(operations) LOOP
  target_table := CASE item->>'type'
   WHEN 'regular' THEN 'regular_on_call_periods'
   WHEN 'exceptionalOnCall' THEN 'exceptional_on_calls'
   WHEN 'exceptionalWork' THEN 'exceptional_works' END;
  IF target_table IS NULL THEN RAISE EXCEPTION 'Invalid operation type' USING ERRCODE = '22023'; END IF;
  operation_id := (item->>'id')::bigint;
  EXECUTE format('SELECT sent_to_rh_at FROM public.%I WHERE id = $1 FOR UPDATE', target_table)
   INTO submitted USING operation_id;
  IF submitted IS NULL THEN RAISE EXCEPTION 'Operation must be sent to RH' USING ERRCODE = '22023'; END IF;
  EXECUTE format('UPDATE public.%I SET treated_at = CASE WHEN $1 THEN COALESCE(treated_at, now()) ELSE NULL END WHERE id = $2', target_table)
   USING treated, operation_id;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.set_rh_treatment(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_rh_treatment(jsonb, boolean) TO authenticated;

COMMIT;
