--
-- PostgreSQL database dump
--

\restrict bXhGTl2vlEyidBXW8DEgBwnWfO5xBCNyMqWON1TlL1PANhxrtii0Fn0RLC4iD4n

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: operation_participant_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.operation_participant_kind AS ENUM (
    'planned',
    'actual'
);


--
-- Name: public_holiday_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.public_holiday_source AS ENUM (
    'api.gouv.fr',
    'manual'
);


--
-- Name: schedule_day; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.schedule_day AS ENUM (
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'public_holiday'
);


--
-- Name: signature_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.signature_mode AS ENUM (
    'name',
    'image',
    'draw'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'user',
    'initiator',
    'director'
);


--
-- Name: visa_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visa_scope AS ENUM (
    'regular_period_agent',
    'regular_period_director',
    'regular_intervention_agent',
    'exceptional_participant_agent',
    'exceptional_intervention_agent',
    'exceptional_operation_initiator',
    'exceptional_operation_director',
    'exceptional_planned_initiator',
    'exceptional_planned_director',
    'exceptional_actual_initiator',
    'exceptional_actual_director'
);


--
-- Name: prevent_exceptional_intervention_outside_actual_period(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_exceptional_intervention_outside_actual_period() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if not exists (
    select 1 from public.exceptional_operation_participants participant
    where participant.exceptional_on_call_id is not distinct from new.exceptional_on_call_id
      and participant.exceptional_work_id is not distinct from new.exceptional_work_id
      and participant.participant_kind = 'actual' and participant.user_id = new.user_id
      and participant.starts_at <= new.starts_at and participant.ends_at >= new.ends_at
  ) then
    raise exception 'Exceptional intervention must stay inside an actual participant period for the same user';
  end if;
  return new;
end;
$$;


--
-- Name: prevent_regular_intervention_outside_period(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_regular_intervention_outside_period() RETURNS trigger
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


--
-- Name: prevent_rh_sent_exceptional_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_rh_sent_exceptional_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if old.sent_to_rh_at is not null and new.sent_to_rh_at is not null then
    raise exception 'Exceptional operation already sent to RH';
  end if;

  return new;
end;
$$;


--
-- Name: prevent_rh_sent_regular_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_rh_sent_regular_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if old.sent_to_rh_at is not null and new.sent_to_rh_at is not null then
    raise exception 'Regular on-call period already sent to RH';
  end if;

  return new;
end;
$$;


--
-- Name: set_app_documents_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_app_documents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id bigint NOT NULL,
    auth_user_id uuid NOT NULL,
    email text NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    signature_mode public.signature_mode DEFAULT 'name'::public.signature_mode NOT NULL,
    signature_name text DEFAULT ''::text NOT NULL,
    signature_image text DEFAULT ''::text NOT NULL,
    signature_drawing text DEFAULT ''::text NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.app_users ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.app_users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: exceptional_entity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exceptional_entity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exceptional_interventions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exceptional_interventions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    was_on_site boolean DEFAULT false NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    comment text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exceptional_on_call_id bigint,
    exceptional_work_id bigint,
    CONSTRAINT exceptional_interventions_dates_order CHECK ((starts_at < ends_at)),
    CONSTRAINT interventions_single_parent CHECK ((num_nonnulls(exceptional_on_call_id, exceptional_work_id) = 1))
);


--
-- Name: exceptional_interventions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.exceptional_interventions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.exceptional_interventions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: exceptional_on_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exceptional_on_calls (
    id bigint DEFAULT nextval('public.exceptional_entity_id_seq'::regclass) NOT NULL,
    initiator_user_id bigint,
    operation_manager_user_id bigint,
    operation_manager_name text DEFAULT ''::text NOT NULL,
    title text NOT NULL,
    planned_starts_at timestamp with time zone,
    planned_ends_at timestamp with time zone,
    actual_starts_at timestamp with time zone,
    actual_ends_at timestamp with time zone,
    sent_to_rh_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exceptional_operations_actual_dates_order CHECK (((actual_starts_at IS NULL) OR (actual_ends_at IS NULL) OR (actual_starts_at < actual_ends_at))),
    CONSTRAINT exceptional_operations_planned_dates_order CHECK (((planned_starts_at IS NULL) OR (planned_ends_at IS NULL) OR (planned_starts_at < planned_ends_at))),
    CONSTRAINT exceptional_operations_title_not_blank CHECK ((btrim(title) <> ''::text))
);


--
-- Name: exceptional_operation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exceptional_operation_participants (
    id bigint NOT NULL,
    participant_kind public.operation_participant_kind NOT NULL,
    user_id bigint NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exceptional_on_call_id bigint,
    exceptional_work_id bigint,
    CONSTRAINT exceptional_operation_participants_dates_order CHECK ((starts_at < ends_at)),
    CONSTRAINT participants_single_parent CHECK ((num_nonnulls(exceptional_on_call_id, exceptional_work_id) = 1))
);


--
-- Name: exceptional_operation_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.exceptional_operation_participants ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.exceptional_operation_participants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: exceptional_works; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exceptional_works (
    id bigint DEFAULT nextval('public.exceptional_entity_id_seq'::regclass) NOT NULL,
    initiator_user_id bigint,
    operation_manager_user_id bigint,
    operation_manager_name text DEFAULT ''::text NOT NULL,
    title text NOT NULL,
    planned_starts_at timestamp with time zone,
    planned_ends_at timestamp with time zone,
    actual_starts_at timestamp with time zone,
    actual_ends_at timestamp with time zone,
    sent_to_rh_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exceptional_operations_actual_dates_order CHECK (((actual_starts_at IS NULL) OR (actual_ends_at IS NULL) OR (actual_starts_at < actual_ends_at))),
    CONSTRAINT exceptional_operations_planned_dates_order CHECK (((planned_starts_at IS NULL) OR (planned_ends_at IS NULL) OR (planned_starts_at < planned_ends_at))),
    CONSTRAINT exceptional_operations_title_not_blank CHECK ((btrim(title) <> ''::text))
);


--
-- Name: public_holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_holidays (
    id bigint NOT NULL,
    zone text NOT NULL,
    holiday_date date NOT NULL,
    label text NOT NULL,
    source public.public_holiday_source DEFAULT 'manual'::public.public_holiday_source NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT public_holidays_label_not_blank CHECK ((btrim(label) <> ''::text)),
    CONSTRAINT public_holidays_zone_not_blank CHECK ((btrim(zone) <> ''::text))
);


--
-- Name: public_holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.public_holidays ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.public_holidays_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: regular_interventions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regular_interventions (
    id bigint NOT NULL,
    regular_period_id bigint NOT NULL,
    user_id bigint NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    comment text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT regular_interventions_dates_order CHECK ((starts_at < ends_at))
);


--
-- Name: regular_interventions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.regular_interventions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.regular_interventions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: regular_on_call_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regular_on_call_periods (
    id bigint NOT NULL,
    team_id bigint,
    user_id bigint NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    sent_to_rh_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT regular_on_call_periods_dates_order CHECK ((starts_at < ends_at))
);


--
-- Name: regular_on_call_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.regular_on_call_periods ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.regular_on_call_periods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rh_export_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rh_export_settings (
    id bigint NOT NULL,
    singleton_key boolean DEFAULT true NOT NULL,
    generation_api_url text DEFAULT 'http://localhost:3000/v1/documents/generate'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rh_export_settings_singleton CHECK (singleton_key),
    CONSTRAINT rh_export_settings_url_not_blank CHECK ((btrim(generation_api_url) <> ''::text))
);


--
-- Name: rh_export_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rh_export_settings ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rh_export_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rh_export_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rh_export_templates (
    id bigint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    file_name text DEFAULT ''::text NOT NULL,
    template_file_name text DEFAULT ''::text NOT NULL,
    data_model_file_name text DEFAULT ''::text NOT NULL,
    generation_template jsonb,
    data_model jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rh_export_templates_label_not_blank CHECK ((btrim(label) <> ''::text))
);


--
-- Name: rh_export_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rh_export_templates ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rh_export_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rh_on_call_compensation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rh_on_call_compensation_rules (
    id bigint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    coefficient numeric(10,4) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rh_on_call_compensation_rules_label_not_blank CHECK ((btrim(label) <> ''::text))
);


--
-- Name: rh_on_call_compensation_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rh_on_call_compensation_rules ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rh_on_call_compensation_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rh_period_compensation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rh_period_compensation_rules (
    id bigint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    intervention_coefficient numeric(10,4) DEFAULT 0 NOT NULL,
    work_coefficient numeric(10,4) DEFAULT 0 NOT NULL,
    rest_coefficient numeric(10,4) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rh_period_compensation_rules_label_not_blank CHECK ((btrim(label) <> ''::text))
);


--
-- Name: rh_period_compensation_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rh_period_compensation_rules ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rh_period_compensation_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schedule_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_rules (
    id bigint NOT NULL,
    day public.schedule_day NOT NULL,
    hour_start time without time zone NOT NULL,
    hour_end time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_rules_hours_order CHECK ((hour_start < hour_end))
);


--
-- Name: schedule_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.schedule_rules ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.schedule_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    team_id bigint NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id bigint NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teams_name_not_blank CHECK ((btrim(name) <> ''::text))
);


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.teams ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: visas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visas (
    id bigint NOT NULL,
    scope public.visa_scope NOT NULL,
    regular_period_id bigint,
    regular_intervention_id bigint,
    exceptional_participant_id bigint,
    exceptional_intervention_id bigint,
    signed_by_user_id bigint,
    signed_by_name text DEFAULT ''::text NOT NULL,
    signed_at timestamp with time zone,
    signature_mode public.signature_mode,
    signature_value text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exceptional_on_call_id bigint,
    exceptional_work_id bigint,
    CONSTRAINT visas_signed_consistency CHECK ((((signed_at IS NULL) AND (signed_by_user_id IS NULL) AND (signed_by_name = ''::text)) OR ((signed_at IS NOT NULL) AND (signed_by_name <> ''::text)))),
    CONSTRAINT visas_single_target CHECK ((num_nonnulls(regular_period_id, regular_intervention_id, exceptional_on_call_id, exceptional_work_id, exceptional_participant_id, exceptional_intervention_id) = 1))
);


--
-- Name: visas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.visas ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.visas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: app_users app_users_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: app_users app_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_email_key UNIQUE (email);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: exceptional_interventions exceptional_interventions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_interventions
    ADD CONSTRAINT exceptional_interventions_pkey PRIMARY KEY (id);


--
-- Name: exceptional_on_calls exceptional_on_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_on_calls
    ADD CONSTRAINT exceptional_on_calls_pkey PRIMARY KEY (id);


--
-- Name: exceptional_operation_participants exceptional_operation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_operation_participants
    ADD CONSTRAINT exceptional_operation_participants_pkey PRIMARY KEY (id);


--
-- Name: exceptional_works exceptional_works_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_works
    ADD CONSTRAINT exceptional_works_pkey PRIMARY KEY (id);


--
-- Name: public_holidays public_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_pkey PRIMARY KEY (id);


--
-- Name: public_holidays public_holidays_zone_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_zone_holiday_date_key UNIQUE (zone, holiday_date);


--
-- Name: regular_interventions regular_interventions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regular_interventions
    ADD CONSTRAINT regular_interventions_pkey PRIMARY KEY (id);


--
-- Name: regular_on_call_periods regular_on_call_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regular_on_call_periods
    ADD CONSTRAINT regular_on_call_periods_pkey PRIMARY KEY (id);


--
-- Name: rh_export_settings rh_export_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rh_export_settings
    ADD CONSTRAINT rh_export_settings_pkey PRIMARY KEY (id);


--
-- Name: rh_export_settings rh_export_settings_singleton_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rh_export_settings
    ADD CONSTRAINT rh_export_settings_singleton_key_key UNIQUE (singleton_key);


--
-- Name: rh_export_templates rh_export_templates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rh_export_templates
    ADD CONSTRAINT rh_export_templates_code_key UNIQUE (code);


--
-- Name: rh_export_templates rh_export_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rh_export_templates
    ADD CONSTRAINT rh_export_templates_pkey PRIMARY KEY (id);


--
-- Name: rh_on_call_compensation_rules rh_on_call_compensation_rules_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rh_on_call_compensation_rules
    ADD CONSTRAINT rh_on_call_compensation_rules_code_key UNIQUE (code);


--
-- Name: rh_on_call_compensation_rules rh_on_call_compensation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rh_on_call_compensation_rules
    ADD CONSTRAINT rh_on_call_compensation_rules_pkey PRIMARY KEY (id);


--
-- Name: rh_period_compensation_rules rh_period_compensation_rules_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rh_period_compensation_rules
    ADD CONSTRAINT rh_period_compensation_rules_code_key UNIQUE (code);


--
-- Name: rh_period_compensation_rules rh_period_compensation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rh_period_compensation_rules
    ADD CONSTRAINT rh_period_compensation_rules_pkey PRIMARY KEY (id);


--
-- Name: schedule_rules schedule_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_rules
    ADD CONSTRAINT schedule_rules_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: visas visas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visas
    ADD CONSTRAINT visas_pkey PRIMARY KEY (id);


--
-- Name: app_documents_collection_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_documents_collection_idx ON public.app_documents2 USING btree (collection_name);


--
-- Name: app_documents_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_documents_parent_idx ON public.app_documents2 USING btree (parent_collection_name, parent_id);


--
-- Name: exceptional_interventions_exceptional_on_call_id_starts_at__idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exceptional_interventions_exceptional_on_call_id_starts_at__idx ON public.exceptional_interventions USING btree (exceptional_on_call_id, starts_at, ends_at);


--
-- Name: exceptional_interventions_exceptional_work_id_starts_at_end_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exceptional_interventions_exceptional_work_id_starts_at_end_idx ON public.exceptional_interventions USING btree (exceptional_work_id, starts_at, ends_at);


--
-- Name: exceptional_on_calls_sent_to_rh_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exceptional_on_calls_sent_to_rh_at_idx ON public.exceptional_on_calls USING btree (sent_to_rh_at) WHERE (sent_to_rh_at IS NOT NULL);


--
-- Name: exceptional_operation_partici_exceptional_on_call_id_partic_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exceptional_operation_partici_exceptional_on_call_id_partic_idx ON public.exceptional_operation_participants USING btree (exceptional_on_call_id, participant_kind);


--
-- Name: exceptional_operation_partici_exceptional_work_id_participa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exceptional_operation_partici_exceptional_work_id_participa_idx ON public.exceptional_operation_participants USING btree (exceptional_work_id, participant_kind);


--
-- Name: exceptional_works_sent_to_rh_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exceptional_works_sent_to_rh_at_idx ON public.exceptional_works USING btree (sent_to_rh_at) WHERE (sent_to_rh_at IS NOT NULL);


--
-- Name: regular_interventions_period_dates_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX regular_interventions_period_dates_idx ON public.regular_interventions USING btree (regular_period_id, starts_at, ends_at);


--
-- Name: regular_on_call_periods_user_dates_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX regular_on_call_periods_user_dates_idx ON public.regular_on_call_periods USING btree (user_id, starts_at, ends_at);


--
-- Name: visas_exceptional_intervention_scope_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visas_exceptional_intervention_scope_uidx ON public.visas USING btree (exceptional_intervention_id, scope) WHERE (exceptional_intervention_id IS NOT NULL);


--
-- Name: visas_exceptional_on_call_id_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visas_exceptional_on_call_id_scope_idx ON public.visas USING btree (exceptional_on_call_id, scope) WHERE (exceptional_on_call_id IS NOT NULL);


--
-- Name: visas_exceptional_participant_scope_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visas_exceptional_participant_scope_uidx ON public.visas USING btree (exceptional_participant_id, scope) WHERE (exceptional_participant_id IS NOT NULL);


--
-- Name: visas_exceptional_work_id_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visas_exceptional_work_id_scope_idx ON public.visas USING btree (exceptional_work_id, scope) WHERE (exceptional_work_id IS NOT NULL);


--
-- Name: visas_regular_intervention_scope_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visas_regular_intervention_scope_uidx ON public.visas USING btree (regular_intervention_id, scope) WHERE (regular_intervention_id IS NOT NULL);


--
-- Name: visas_regular_period_scope_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visas_regular_period_scope_uidx ON public.visas USING btree (regular_period_id, scope) WHERE (regular_period_id IS NOT NULL);


--
-- Name: exceptional_interventions check_exceptional_intervention_actual_period; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_exceptional_intervention_actual_period BEFORE INSERT OR UPDATE ON public.exceptional_interventions FOR EACH ROW EXECUTE FUNCTION public.prevent_exceptional_intervention_outside_actual_period();


--
-- Name: regular_interventions check_regular_intervention_period; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_regular_intervention_period BEFORE INSERT OR UPDATE ON public.regular_interventions FOR EACH ROW EXECUTE FUNCTION public.prevent_regular_intervention_outside_period();


--
-- Name: exceptional_on_calls lock_after_rh_sent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lock_after_rh_sent BEFORE UPDATE ON public.exceptional_on_calls FOR EACH ROW WHEN (((old.sent_to_rh_at IS NOT NULL) AND ((old.initiator_user_id IS DISTINCT FROM new.initiator_user_id) OR (old.operation_manager_user_id IS DISTINCT FROM new.operation_manager_user_id) OR (old.operation_manager_name IS DISTINCT FROM new.operation_manager_name) OR (old.title IS DISTINCT FROM new.title) OR (old.planned_starts_at IS DISTINCT FROM new.planned_starts_at) OR (old.planned_ends_at IS DISTINCT FROM new.planned_ends_at) OR (old.actual_starts_at IS DISTINCT FROM new.actual_starts_at) OR (old.actual_ends_at IS DISTINCT FROM new.actual_ends_at)))) EXECUTE FUNCTION public.prevent_rh_sent_exceptional_changes();


--
-- Name: exceptional_works lock_after_rh_sent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lock_after_rh_sent BEFORE UPDATE ON public.exceptional_works FOR EACH ROW WHEN (((old.sent_to_rh_at IS NOT NULL) AND ((old.initiator_user_id IS DISTINCT FROM new.initiator_user_id) OR (old.operation_manager_user_id IS DISTINCT FROM new.operation_manager_user_id) OR (old.operation_manager_name IS DISTINCT FROM new.operation_manager_name) OR (old.title IS DISTINCT FROM new.title) OR (old.planned_starts_at IS DISTINCT FROM new.planned_starts_at) OR (old.planned_ends_at IS DISTINCT FROM new.planned_ends_at) OR (old.actual_starts_at IS DISTINCT FROM new.actual_starts_at) OR (old.actual_ends_at IS DISTINCT FROM new.actual_ends_at)))) EXECUTE FUNCTION public.prevent_rh_sent_exceptional_changes();


--
-- Name: regular_on_call_periods lock_regular_period_after_rh_sent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lock_regular_period_after_rh_sent BEFORE UPDATE ON public.regular_on_call_periods FOR EACH ROW WHEN (((old.sent_to_rh_at IS NOT NULL) AND ((old.team_id IS DISTINCT FROM new.team_id) OR (old.user_id IS DISTINCT FROM new.user_id) OR (old.starts_at IS DISTINCT FROM new.starts_at) OR (old.ends_at IS DISTINCT FROM new.ends_at)))) EXECUTE FUNCTION public.prevent_rh_sent_regular_changes();


--
-- Name: app_documents2 set_app_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_app_documents_updated_at BEFORE UPDATE ON public.app_documents2 FOR EACH ROW EXECUTE FUNCTION public.set_app_documents_updated_at();


--
-- Name: app_users set_app_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_app_users_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: exceptional_interventions set_exceptional_interventions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_exceptional_interventions_updated_at BEFORE UPDATE ON public.exceptional_interventions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: exceptional_operation_participants set_exceptional_operation_participants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_exceptional_operation_participants_updated_at BEFORE UPDATE ON public.exceptional_operation_participants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: public_holidays set_public_holidays_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_public_holidays_updated_at BEFORE UPDATE ON public.public_holidays FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: regular_interventions set_regular_interventions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_regular_interventions_updated_at BEFORE UPDATE ON public.regular_interventions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: regular_on_call_periods set_regular_on_call_periods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_regular_on_call_periods_updated_at BEFORE UPDATE ON public.regular_on_call_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rh_export_settings set_rh_export_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rh_export_settings_updated_at BEFORE UPDATE ON public.rh_export_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rh_export_templates set_rh_export_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rh_export_templates_updated_at BEFORE UPDATE ON public.rh_export_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rh_on_call_compensation_rules set_rh_on_call_compensation_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rh_on_call_compensation_rules_updated_at BEFORE UPDATE ON public.rh_on_call_compensation_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rh_period_compensation_rules set_rh_period_compensation_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rh_period_compensation_rules_updated_at BEFORE UPDATE ON public.rh_period_compensation_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: schedule_rules set_schedule_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_schedule_rules_updated_at BEFORE UPDATE ON public.schedule_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: teams set_teams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: exceptional_on_calls set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exceptional_on_calls FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: exceptional_works set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exceptional_works FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: visas set_visas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_visas_updated_at BEFORE UPDATE ON public.visas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: app_users app_users_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: exceptional_interventions exceptional_interventions_exceptional_on_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_interventions
    ADD CONSTRAINT exceptional_interventions_exceptional_on_call_id_fkey FOREIGN KEY (exceptional_on_call_id) REFERENCES public.exceptional_on_calls(id) ON DELETE CASCADE;


--
-- Name: exceptional_interventions exceptional_interventions_exceptional_work_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_interventions
    ADD CONSTRAINT exceptional_interventions_exceptional_work_id_fkey FOREIGN KEY (exceptional_work_id) REFERENCES public.exceptional_works(id) ON DELETE CASCADE;


--
-- Name: exceptional_interventions exceptional_interventions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_interventions
    ADD CONSTRAINT exceptional_interventions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: exceptional_on_calls exceptional_on_calls_initiator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_on_calls
    ADD CONSTRAINT exceptional_on_calls_initiator_user_id_fkey FOREIGN KEY (initiator_user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: exceptional_on_calls exceptional_on_calls_operation_manager_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_on_calls
    ADD CONSTRAINT exceptional_on_calls_operation_manager_user_id_fkey FOREIGN KEY (operation_manager_user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: exceptional_operation_participants exceptional_operation_participants_exceptional_on_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_operation_participants
    ADD CONSTRAINT exceptional_operation_participants_exceptional_on_call_id_fkey FOREIGN KEY (exceptional_on_call_id) REFERENCES public.exceptional_on_calls(id) ON DELETE CASCADE;


--
-- Name: exceptional_operation_participants exceptional_operation_participants_exceptional_work_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_operation_participants
    ADD CONSTRAINT exceptional_operation_participants_exceptional_work_id_fkey FOREIGN KEY (exceptional_work_id) REFERENCES public.exceptional_works(id) ON DELETE CASCADE;


--
-- Name: exceptional_operation_participants exceptional_operation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_operation_participants
    ADD CONSTRAINT exceptional_operation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: exceptional_works exceptional_works_initiator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_works
    ADD CONSTRAINT exceptional_works_initiator_user_id_fkey FOREIGN KEY (initiator_user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: exceptional_works exceptional_works_operation_manager_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exceptional_works
    ADD CONSTRAINT exceptional_works_operation_manager_user_id_fkey FOREIGN KEY (operation_manager_user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: regular_interventions regular_interventions_regular_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regular_interventions
    ADD CONSTRAINT regular_interventions_regular_period_id_fkey FOREIGN KEY (regular_period_id) REFERENCES public.regular_on_call_periods(id) ON DELETE CASCADE;


--
-- Name: regular_interventions regular_interventions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regular_interventions
    ADD CONSTRAINT regular_interventions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: regular_on_call_periods regular_on_call_periods_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regular_on_call_periods
    ADD CONSTRAINT regular_on_call_periods_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: regular_on_call_periods regular_on_call_periods_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regular_on_call_periods
    ADD CONSTRAINT regular_on_call_periods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;


--
-- Name: visas visas_exceptional_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visas
    ADD CONSTRAINT visas_exceptional_intervention_id_fkey FOREIGN KEY (exceptional_intervention_id) REFERENCES public.exceptional_interventions(id) ON DELETE CASCADE;


--
-- Name: visas visas_exceptional_on_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visas
    ADD CONSTRAINT visas_exceptional_on_call_id_fkey FOREIGN KEY (exceptional_on_call_id) REFERENCES public.exceptional_on_calls(id) ON DELETE CASCADE;


--
-- Name: visas visas_exceptional_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visas
    ADD CONSTRAINT visas_exceptional_participant_id_fkey FOREIGN KEY (exceptional_participant_id) REFERENCES public.exceptional_operation_participants(id) ON DELETE CASCADE;


--
-- Name: visas visas_exceptional_work_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visas
    ADD CONSTRAINT visas_exceptional_work_id_fkey FOREIGN KEY (exceptional_work_id) REFERENCES public.exceptional_works(id) ON DELETE CASCADE;


--
-- Name: visas visas_regular_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visas
    ADD CONSTRAINT visas_regular_intervention_id_fkey FOREIGN KEY (regular_intervention_id) REFERENCES public.regular_interventions(id) ON DELETE CASCADE;


--
-- Name: visas visas_regular_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visas
    ADD CONSTRAINT visas_regular_period_id_fkey FOREIGN KEY (regular_period_id) REFERENCES public.regular_on_call_periods(id) ON DELETE CASCADE;


--
-- Name: visas visas_signed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visas
    ADD CONSTRAINT visas_signed_by_user_id_fkey FOREIGN KEY (signed_by_user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: app_documents2 Authenticated users can delete app documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete app documents" ON public.app_documents2 FOR DELETE TO authenticated USING (true);


--
-- Name: app_documents2 Authenticated users can insert app documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert app documents" ON public.app_documents2 FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: app_documents2 Authenticated users can read app documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read app documents" ON public.app_documents2 FOR SELECT TO authenticated USING (true);


--
-- Name: app_documents2 Authenticated users can update app documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update app documents" ON public.app_documents2 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: app_documents2; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_documents2 ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

--
-- Name: exceptional_on_calls authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_access ON public.exceptional_on_calls TO authenticated USING (true) WITH CHECK (true);


--
-- Name: exceptional_works authenticated_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_access ON public.exceptional_works TO authenticated USING (true) WITH CHECK (true);


--
-- Name: app_users authenticated_delete_app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_app_users ON public.app_users FOR DELETE TO authenticated USING (true);


--
-- Name: exceptional_interventions authenticated_delete_exceptional_interventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_exceptional_interventions ON public.exceptional_interventions FOR DELETE TO authenticated USING (true);


--
-- Name: exceptional_operation_participants authenticated_delete_exceptional_operation_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_exceptional_operation_participants ON public.exceptional_operation_participants FOR DELETE TO authenticated USING (true);


--
-- Name: public_holidays authenticated_delete_public_holidays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_public_holidays ON public.public_holidays FOR DELETE TO authenticated USING (true);


--
-- Name: regular_interventions authenticated_delete_regular_interventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_regular_interventions ON public.regular_interventions FOR DELETE TO authenticated USING (true);


--
-- Name: regular_on_call_periods authenticated_delete_regular_on_call_periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_regular_on_call_periods ON public.regular_on_call_periods FOR DELETE TO authenticated USING (true);


--
-- Name: rh_export_settings authenticated_delete_rh_export_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_rh_export_settings ON public.rh_export_settings FOR DELETE TO authenticated USING (true);


--
-- Name: rh_export_templates authenticated_delete_rh_export_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_rh_export_templates ON public.rh_export_templates FOR DELETE TO authenticated USING (true);


--
-- Name: rh_on_call_compensation_rules authenticated_delete_rh_on_call_compensation_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_rh_on_call_compensation_rules ON public.rh_on_call_compensation_rules FOR DELETE TO authenticated USING (true);


--
-- Name: rh_period_compensation_rules authenticated_delete_rh_period_compensation_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_rh_period_compensation_rules ON public.rh_period_compensation_rules FOR DELETE TO authenticated USING (true);


--
-- Name: schedule_rules authenticated_delete_schedule_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_schedule_rules ON public.schedule_rules FOR DELETE TO authenticated USING (true);


--
-- Name: team_members authenticated_delete_team_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_team_members ON public.team_members FOR DELETE TO authenticated USING (true);


--
-- Name: teams authenticated_delete_teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_teams ON public.teams FOR DELETE TO authenticated USING (true);


--
-- Name: visas authenticated_delete_visas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_delete_visas ON public.visas FOR DELETE TO authenticated USING (true);


--
-- Name: app_users authenticated_insert_app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_app_users ON public.app_users FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: exceptional_interventions authenticated_insert_exceptional_interventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_exceptional_interventions ON public.exceptional_interventions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: exceptional_operation_participants authenticated_insert_exceptional_operation_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_exceptional_operation_participants ON public.exceptional_operation_participants FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: public_holidays authenticated_insert_public_holidays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_public_holidays ON public.public_holidays FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: regular_interventions authenticated_insert_regular_interventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_regular_interventions ON public.regular_interventions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: regular_on_call_periods authenticated_insert_regular_on_call_periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_regular_on_call_periods ON public.regular_on_call_periods FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: rh_export_settings authenticated_insert_rh_export_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_rh_export_settings ON public.rh_export_settings FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: rh_export_templates authenticated_insert_rh_export_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_rh_export_templates ON public.rh_export_templates FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: rh_on_call_compensation_rules authenticated_insert_rh_on_call_compensation_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_rh_on_call_compensation_rules ON public.rh_on_call_compensation_rules FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: rh_period_compensation_rules authenticated_insert_rh_period_compensation_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_rh_period_compensation_rules ON public.rh_period_compensation_rules FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: schedule_rules authenticated_insert_schedule_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_schedule_rules ON public.schedule_rules FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: team_members authenticated_insert_team_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_team_members ON public.team_members FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: teams authenticated_insert_teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_teams ON public.teams FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: visas authenticated_insert_visas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_visas ON public.visas FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: app_users authenticated_read_app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_app_users ON public.app_users FOR SELECT TO authenticated USING (true);


--
-- Name: exceptional_interventions authenticated_read_exceptional_interventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_exceptional_interventions ON public.exceptional_interventions FOR SELECT TO authenticated USING (true);


--
-- Name: exceptional_operation_participants authenticated_read_exceptional_operation_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_exceptional_operation_participants ON public.exceptional_operation_participants FOR SELECT TO authenticated USING (true);


--
-- Name: public_holidays authenticated_read_public_holidays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_public_holidays ON public.public_holidays FOR SELECT TO authenticated USING (true);


--
-- Name: regular_interventions authenticated_read_regular_interventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_regular_interventions ON public.regular_interventions FOR SELECT TO authenticated USING (true);


--
-- Name: regular_on_call_periods authenticated_read_regular_on_call_periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_regular_on_call_periods ON public.regular_on_call_periods FOR SELECT TO authenticated USING (true);


--
-- Name: rh_export_settings authenticated_read_rh_export_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_rh_export_settings ON public.rh_export_settings FOR SELECT TO authenticated USING (true);


--
-- Name: rh_export_templates authenticated_read_rh_export_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_rh_export_templates ON public.rh_export_templates FOR SELECT TO authenticated USING (true);


--
-- Name: rh_on_call_compensation_rules authenticated_read_rh_on_call_compensation_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_rh_on_call_compensation_rules ON public.rh_on_call_compensation_rules FOR SELECT TO authenticated USING (true);


--
-- Name: rh_period_compensation_rules authenticated_read_rh_period_compensation_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_rh_period_compensation_rules ON public.rh_period_compensation_rules FOR SELECT TO authenticated USING (true);


--
-- Name: schedule_rules authenticated_read_schedule_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_schedule_rules ON public.schedule_rules FOR SELECT TO authenticated USING (true);


--
-- Name: team_members authenticated_read_team_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_team_members ON public.team_members FOR SELECT TO authenticated USING (true);


--
-- Name: teams authenticated_read_teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_teams ON public.teams FOR SELECT TO authenticated USING (true);


--
-- Name: visas authenticated_read_visas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_visas ON public.visas FOR SELECT TO authenticated USING (true);


--
-- Name: app_users authenticated_update_app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_app_users ON public.app_users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: exceptional_interventions authenticated_update_exceptional_interventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_exceptional_interventions ON public.exceptional_interventions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: exceptional_operation_participants authenticated_update_exceptional_operation_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_exceptional_operation_participants ON public.exceptional_operation_participants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: public_holidays authenticated_update_public_holidays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_public_holidays ON public.public_holidays FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: regular_interventions authenticated_update_regular_interventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_regular_interventions ON public.regular_interventions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: regular_on_call_periods authenticated_update_regular_on_call_periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_regular_on_call_periods ON public.regular_on_call_periods FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: rh_export_settings authenticated_update_rh_export_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_rh_export_settings ON public.rh_export_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: rh_export_templates authenticated_update_rh_export_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_rh_export_templates ON public.rh_export_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: rh_on_call_compensation_rules authenticated_update_rh_on_call_compensation_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_rh_on_call_compensation_rules ON public.rh_on_call_compensation_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: rh_period_compensation_rules authenticated_update_rh_period_compensation_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_rh_period_compensation_rules ON public.rh_period_compensation_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: schedule_rules authenticated_update_schedule_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_schedule_rules ON public.schedule_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: team_members authenticated_update_team_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_team_members ON public.team_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: teams authenticated_update_teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_teams ON public.teams FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: visas authenticated_update_visas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_visas ON public.visas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: exceptional_interventions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exceptional_interventions ENABLE ROW LEVEL SECURITY;

--
-- Name: exceptional_on_calls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exceptional_on_calls ENABLE ROW LEVEL SECURITY;

--
-- Name: exceptional_operation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exceptional_operation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: exceptional_works; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exceptional_works ENABLE ROW LEVEL SECURITY;

--
-- Name: public_holidays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

--
-- Name: regular_interventions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regular_interventions ENABLE ROW LEVEL SECURITY;

--
-- Name: regular_on_call_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regular_on_call_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: rh_export_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rh_export_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: rh_export_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rh_export_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: rh_on_call_compensation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rh_on_call_compensation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: rh_period_compensation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rh_period_compensation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: visas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visas ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict bXhGTl2vlEyidBXW8DEgBwnWfO5xBCNyMqWON1TlL1PANhxrtii0Fn0RLC4iD4n

