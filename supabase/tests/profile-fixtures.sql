-- Explicit defaults are test-only: older access cases focus on other invariants.
INSERT INTO public.directions(id,name) VALUES (1,'Direction test'),(2,'Autre direction');
SELECT setval(pg_get_serial_sequence('public.directions','id'),2);
ALTER TABLE public.regular_on_call_periods ALTER COLUMN direction_id SET DEFAULT 1;
ALTER TABLE public.exceptional_on_calls ALTER COLUMN direction_id SET DEFAULT 1;
ALTER TABLE public.exceptional_works ALTER COLUMN direction_id SET DEFAULT 1;
-- Fictitious identities for disposable test databases.
INSERT INTO auth.users VALUES
 ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
 ('00000000-0000-4000-8000-000000000002', 'user@example.test'),
 ('00000000-0000-4000-8000-000000000003', 'initiator@example.test'),
 ('00000000-0000-4000-8000-000000000004', 'director@example.test'),
 ('00000000-0000-4000-8000-000000000005', 'new@example.test');
UPDATE public.app_users SET role = (CASE email WHEN 'admin@example.test' THEN 'admin'
 WHEN 'initiator@example.test' THEN 'initiator' WHEN 'director@example.test' THEN 'director'
 ELSE 'user' END)::public.user_role, direction_id = 1 WHERE email <> 'new@example.test';
