-- Minimal existing domain tables: tests focus on INSERT permissions, not compensation rules.
CREATE TABLE public.regular_on_call_periods (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text);
CREATE TABLE public.exceptional_on_calls (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text);
CREATE TABLE public.exceptional_works (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text);
CREATE TABLE public.regular_interventions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 regular_period_id bigint NOT NULL REFERENCES public.regular_on_call_periods(id), comment text
);
CREATE TABLE public.exceptional_on_call_interventions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 on_call_id bigint NOT NULL REFERENCES public.exceptional_on_calls(id), comment text
);
INSERT INTO public.regular_on_call_periods (title) VALUES ('Existing period');
INSERT INTO public.exceptional_on_calls (title) VALUES ('Existing on-call');
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['regular_on_call_periods','exceptional_on_calls','exceptional_works',
  'regular_interventions','exceptional_on_call_interventions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('GRANT ALL ON public.%I TO authenticated, anon', table_name);
  EXECUTE format('CREATE POLICY legacy_all_access ON public.%I TO authenticated USING (true) WITH CHECK (true)', table_name);
 END LOOP;
END; $$;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
