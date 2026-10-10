-- Bring the isolated fixtures to the split-operation schema used by the repository.
ALTER TABLE public.exceptional_on_calls ADD initiator_user_id bigint REFERENCES public.app_users(id);
ALTER TABLE public.exceptional_works ADD initiator_user_id bigint REFERENCES public.app_users(id);
ALTER TABLE public.exceptional_on_call_interventions RENAME COLUMN on_call_id TO operation_id;
ALTER TABLE public.exceptional_on_call_participants ADD operation_id bigint REFERENCES public.exceptional_on_calls(id);
ALTER TABLE public.exceptional_work_participants ADD operation_id bigint REFERENCES public.exceptional_works(id);
UPDATE public.exceptional_on_calls SET initiator_user_id = (SELECT id FROM public.app_users WHERE role = 'initiator') WHERE id = 1;
UPDATE public.exceptional_works SET initiator_user_id = (SELECT id FROM public.app_users WHERE role = 'initiator') WHERE id = 1;
INSERT INTO public.exceptional_on_calls(id,title,initiator_user_id) OVERRIDING SYSTEM VALUE SELECT 2,'Foreign',id FROM public.app_users WHERE role = 'admin';
INSERT INTO public.exceptional_works(id,title,initiator_user_id) OVERRIDING SYSTEM VALUE SELECT 2,'Foreign',id FROM public.app_users WHERE role = 'admin';
UPDATE public.exceptional_on_call_participants SET operation_id = 2;
UPDATE public.exceptional_work_participants SET operation_id = 2;
UPDATE public.exceptional_on_call_interventions SET operation_id = 2;
