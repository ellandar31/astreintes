-- Extend the isolated minimal fixtures; never alter a developer's real database.
ALTER TABLE public.regular_on_call_periods ADD starts_at timestamptz, ADD ends_at timestamptz;
ALTER TABLE public.exceptional_on_calls ADD planned_starts_at timestamptz, ADD planned_ends_at timestamptz, ADD actual_starts_at timestamptz, ADD actual_ends_at timestamptz;
ALTER TABLE public.exceptional_works ADD planned_starts_at timestamptz, ADD planned_ends_at timestamptz, ADD actual_starts_at timestamptz, ADD actual_ends_at timestamptz;
ALTER TABLE public.regular_interventions ADD user_id bigint REFERENCES public.app_users(id), ADD starts_at timestamptz;
ALTER TABLE public.exceptional_on_call_interventions ADD user_id bigint REFERENCES public.app_users(id), ADD starts_at timestamptz;
CREATE TABLE public.exceptional_on_call_participants (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id bigint REFERENCES public.app_users(id), starts_at timestamptz);
CREATE TABLE public.exceptional_work_participants (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id bigint REFERENCES public.app_users(id), starts_at timestamptz);
INSERT INTO public.exceptional_works (id,title) OVERRIDING SYSTEM VALUE VALUES (1,'Existing work');
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['exceptional_on_call_participants','exceptional_work_participants'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('GRANT ALL ON public.%I TO authenticated, anon', table_name);
  EXECUTE format('CREATE POLICY legacy_all_access ON public.%I TO authenticated USING (true) WITH CHECK (true)', table_name);
  EXECUTE format('INSERT INTO public.%I (user_id) SELECT id FROM public.app_users WHERE role IN (''user'',''initiator'')', table_name);
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['regular_interventions','exceptional_on_call_interventions'] LOOP
  EXECUTE format('INSERT INTO public.%I (%I,user_id,comment) SELECT 1,id,''Original'' FROM public.app_users WHERE role IN (''user'',''initiator'')', table_name,
   CASE table_name WHEN 'regular_interventions' THEN 'regular_period_id' ELSE 'on_call_id' END);
 END LOOP;
END; $$;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
