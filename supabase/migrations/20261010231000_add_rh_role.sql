-- Commit the enum extension before any following migration uses its new value.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'rh';
