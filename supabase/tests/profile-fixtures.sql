-- Fictitious identities for disposable test databases.
INSERT INTO auth.users VALUES
 ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
 ('00000000-0000-4000-8000-000000000002', 'user@example.test'),
 ('00000000-0000-4000-8000-000000000003', 'initiator@example.test'),
 ('00000000-0000-4000-8000-000000000004', 'director@example.test'),
 ('00000000-0000-4000-8000-000000000005', 'new@example.test');
INSERT INTO public.app_users (auth_user_id, email, role)
SELECT id, email, (CASE email WHEN 'admin@example.test' THEN 'admin'
 WHEN 'initiator@example.test' THEN 'initiator' WHEN 'director@example.test' THEN 'director'
 ELSE 'user' END)::public.user_role FROM auth.users WHERE email <> 'new@example.test';
