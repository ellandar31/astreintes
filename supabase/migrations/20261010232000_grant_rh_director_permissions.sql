BEGIN;

-- RH shares director permissions; admin-only profile administration is unchanged.
CREATE OR REPLACE FUNCTION app_private.can_create_operations()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.app_users
 WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin','initiator','director','rh'));
$$;
CREATE OR REPLACE FUNCTION app_private.can_edit_planning()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.app_users
 WHERE auth_user_id = (SELECT auth.uid()) AND role IN ('admin','initiator','director','rh'));
$$;

CREATE OR REPLACE FUNCTION app_private.can_access_exceptional(family text, operation bigint, editing boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.app_users u
  WHERE u.auth_user_id = (SELECT auth.uid()) AND (
   u.role IN ('admin', 'director', 'rh') OR EXISTS (
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
REVOKE ALL ON FUNCTION app_private.can_create_operations(), app_private.can_edit_planning(), app_private.can_access_exceptional(text,bigint,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.can_create_operations(), app_private.can_edit_planning(), app_private.can_access_exceptional(text,bigint,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;