-- ============================================================
-- DEVELOPER SETTLEMENT PAYOUT METHOD
-- Records HOW the developer's share was paid out (cash / upi / split), with the
-- cash/UPI breakdown for split. Idempotent — safe to re-run.
-- ============================================================
ALTER TABLE public.developer_settlements
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS paid_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_upi DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.developer_settlements DROP CONSTRAINT IF EXISTS developer_settlements_method_check;
ALTER TABLE public.developer_settlements ADD CONSTRAINT developer_settlements_method_check
  CHECK (method IN ('cash', 'upi', 'split'));

-- Realtime so the Developer page reflects new settlements live.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.developer_settlements; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.developer_settlements REPLICA IDENTITY FULL;

-- Delivery settlements are already published, but RLS tables also need
-- REPLICA IDENTITY FULL so subscribers are authorized on UPDATE/DELETE events
-- (e.g. a partner seeing their settlement get confirmed live).
ALTER TABLE public.delivery_settlements REPLICA IDENTITY FULL;
