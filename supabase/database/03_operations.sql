-- Fonctions et déclencheurs métier Astreintes.
-- Exécuter après 02_security.sql, avec le rôle postgres. Réexécutable.
-- Supabase fournit auth.users, auth.uid() et les rôles anon/authenticated/service_role.
BEGIN;
SET LOCAL search_path = '';

CREATE OR REPLACE FUNCTION public.prevent_regular_intervention_outside_period() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  parent_period record;
begin
  select user_id, starts_at, ends_at
  into parent_period
  from public.regular_on_call_periods
  where id = new.regular_period_id;

  if parent_period.user_id is null then
    raise exception 'Regular on-call period % does not exist', new.regular_period_id;
  end if;

  if new.user_id <> parent_period.user_id
    or new.starts_at < parent_period.starts_at
    or new.ends_at > parent_period.ends_at then
    raise exception 'Regular intervention must stay inside the parent on-call period for the same user';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.prevent_rh_sent_exceptional_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if old.sent_to_rh_at is not null and new.sent_to_rh_at is not null then
    raise exception 'Exceptional operation already sent to RH';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.prevent_rh_sent_regular_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if old.sent_to_rh_at is not null and new.sent_to_rh_at is not null then
    raise exception 'Regular on-call period already sent to RH';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DROP TRIGGER IF EXISTS check_regular_intervention_period ON public.regular_interventions;

CREATE TRIGGER check_regular_intervention_period BEFORE INSERT OR UPDATE ON public.regular_interventions FOR EACH ROW EXECUTE FUNCTION public.prevent_regular_intervention_outside_period();

DROP TRIGGER IF EXISTS lock_after_rh_sent ON public.exceptional_on_calls;

CREATE TRIGGER lock_after_rh_sent BEFORE UPDATE ON public.exceptional_on_calls FOR EACH ROW WHEN (((old.sent_to_rh_at IS NOT NULL) AND ((old.initiator_user_id IS DISTINCT FROM new.initiator_user_id) OR (old.operation_manager_user_id IS DISTINCT FROM new.operation_manager_user_id) OR (old.operation_manager_name IS DISTINCT FROM new.operation_manager_name) OR (old.title IS DISTINCT FROM new.title) OR (old.planned_starts_at IS DISTINCT FROM new.planned_starts_at) OR (old.planned_ends_at IS DISTINCT FROM new.planned_ends_at) OR (old.actual_starts_at IS DISTINCT FROM new.actual_starts_at) OR (old.actual_ends_at IS DISTINCT FROM new.actual_ends_at)))) EXECUTE FUNCTION public.prevent_rh_sent_exceptional_changes();

DROP TRIGGER IF EXISTS lock_after_rh_sent ON public.exceptional_works;

CREATE TRIGGER lock_after_rh_sent BEFORE UPDATE ON public.exceptional_works FOR EACH ROW WHEN (((old.sent_to_rh_at IS NOT NULL) AND ((old.initiator_user_id IS DISTINCT FROM new.initiator_user_id) OR (old.operation_manager_user_id IS DISTINCT FROM new.operation_manager_user_id) OR (old.operation_manager_name IS DISTINCT FROM new.operation_manager_name) OR (old.title IS DISTINCT FROM new.title) OR (old.planned_starts_at IS DISTINCT FROM new.planned_starts_at) OR (old.planned_ends_at IS DISTINCT FROM new.planned_ends_at) OR (old.actual_starts_at IS DISTINCT FROM new.actual_starts_at) OR (old.actual_ends_at IS DISTINCT FROM new.actual_ends_at)))) EXECUTE FUNCTION public.prevent_rh_sent_exceptional_changes();

DROP TRIGGER IF EXISTS lock_regular_period_after_rh_sent ON public.regular_on_call_periods;

CREATE TRIGGER lock_regular_period_after_rh_sent BEFORE UPDATE ON public.regular_on_call_periods FOR EACH ROW WHEN (((old.sent_to_rh_at IS NOT NULL) AND ((old.team_id IS DISTINCT FROM new.team_id) OR (old.user_id IS DISTINCT FROM new.user_id) OR (old.starts_at IS DISTINCT FROM new.starts_at) OR (old.ends_at IS DISTINCT FROM new.ends_at)))) EXECUTE FUNCTION public.prevent_rh_sent_regular_changes();

DROP TRIGGER IF EXISTS set_app_users_updated_at ON public.app_users;

CREATE TRIGGER set_app_users_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_public_holidays_updated_at ON public.public_holidays;

CREATE TRIGGER set_public_holidays_updated_at BEFORE UPDATE ON public.public_holidays FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_regular_interventions_updated_at ON public.regular_interventions;

CREATE TRIGGER set_regular_interventions_updated_at BEFORE UPDATE ON public.regular_interventions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_regular_on_call_periods_updated_at ON public.regular_on_call_periods;

CREATE TRIGGER set_regular_on_call_periods_updated_at BEFORE UPDATE ON public.regular_on_call_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_rh_on_call_compensation_rules_updated_at ON public.rh_on_call_compensation_rules;

CREATE TRIGGER set_rh_on_call_compensation_rules_updated_at BEFORE UPDATE ON public.rh_on_call_compensation_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_rh_period_compensation_rules_updated_at ON public.rh_period_compensation_rules;

CREATE TRIGGER set_rh_period_compensation_rules_updated_at BEFORE UPDATE ON public.rh_period_compensation_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_schedule_rules_updated_at ON public.schedule_rules;

CREATE TRIGGER set_schedule_rules_updated_at BEFORE UPDATE ON public.schedule_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_teams_updated_at ON public.teams;

CREATE TRIGGER set_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.exceptional_on_calls;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exceptional_on_calls FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.exceptional_works;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exceptional_works FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_visas_updated_at ON public.visas;

CREATE TRIGGER set_visas_updated_at BEFORE UPDATE ON public.visas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.exceptional_on_call_participants;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exceptional_on_call_participants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_exceptional_intervention_outside_actual_period()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.exceptional_on_call_participants p
        WHERE p.operation_id = NEW.operation_id AND p.user_id = NEW.user_id
          AND p.participant_kind = 'actual'
          AND p.starts_at <= NEW.starts_at AND p.ends_at >= NEW.ends_at
    ) THEN
        RAISE EXCEPTION 'Exceptional intervention must stay inside an actual participant period for the same user';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_exceptional_intervention_actual_period ON public.exceptional_on_call_interventions;

CREATE TRIGGER check_exceptional_intervention_actual_period
    BEFORE INSERT OR UPDATE ON public.exceptional_on_call_interventions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_exceptional_intervention_outside_actual_period();

DROP TRIGGER IF EXISTS set_updated_at ON public.exceptional_on_call_interventions;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exceptional_on_call_interventions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.exceptional_on_call_visas;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exceptional_on_call_visas
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.exceptional_work_participants;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exceptional_work_participants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.exceptional_work_visas;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exceptional_work_visas
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger functions are not client-callable RPC endpoints.
REVOKE ALL ON FUNCTION public.prevent_regular_intervention_outside_period(), public.prevent_rh_sent_exceptional_changes(), public.prevent_rh_sent_regular_changes(), public.set_updated_at(), public.prevent_exceptional_intervention_outside_actual_period() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
