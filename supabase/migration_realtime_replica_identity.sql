-- Realtime fix: RLS-protected tables need REPLICA IDENTITY FULL so Supabase
-- Realtime can evaluate row-level security for UPDATE/DELETE events and deliver
-- them to authorized subscribers (e.g. a customer watching their own order's
-- status change live). Without this, customers often don't receive updates.
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.settings REPLICA IDENTITY FULL;
ALTER TABLE public.purchases REPLICA IDENTITY FULL;
ALTER TABLE public.delivery_settlements REPLICA IDENTITY FULL;
