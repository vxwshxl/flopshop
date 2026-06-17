-- ============================================================
-- INCOME METHOD TRANSFERS
-- Reclassify income between payment methods (cash / upi / bank / credit / other)
-- without touching orders — e.g. move ₹160 Bank Transfer + ₹40 Other into Cash.
-- Each transfer is a balanced set of legs (negative = source, positive =
-- destination) that sum to zero; the Reports "Income by Payment Method" totals
-- add these net deltas. Idempotent.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.method_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_method_transfers_date ON public.method_transfers(date DESC);

CREATE TABLE IF NOT EXISTS public.method_transfer_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.method_transfers(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash', 'upi', 'bank', 'credit', 'other')),
  delta DECIMAL(10,2) NOT NULL  -- negative = moved out of this method, positive = into it
);
CREATE INDEX IF NOT EXISTS idx_method_transfer_legs_transfer ON public.method_transfer_legs(transfer_id);

ALTER TABLE public.method_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_transfer_legs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage method transfers" ON public.method_transfers;
CREATE POLICY "Admin manage method transfers" ON public.method_transfers FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Admin manage method transfer legs" ON public.method_transfer_legs;
CREATE POLICY "Admin manage method transfer legs" ON public.method_transfer_legs FOR ALL USING (is_admin());

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.method_transfers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.method_transfer_legs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.method_transfers REPLICA IDENTITY FULL;
ALTER TABLE public.method_transfer_legs REPLICA IDENTITY FULL;
