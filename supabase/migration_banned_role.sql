-- Allow a "banned" role on profiles. Banned users are redirected to /banned on
-- every request (see lib/supabase/middleware.ts) and can do nothing else.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'delivery', 'admin', 'banned'));
