-- ============================================================
-- WITHDRAWALS LEDGER
-- Tracks money taken out of revenue (cash / UPI), with date, amount and purpose
-- — e.g. "Bank withdrawals". A running balance against cash-on-hand can be
-- layered on later; for now this is a ledger with totals by method. Idempotent.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'upi' CHECK (method IN ('cash', 'upi')),
  purpose TEXT,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_date ON public.withdrawals(date DESC);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage withdrawals" ON public.withdrawals;
CREATE POLICY "Admin manage withdrawals" ON public.withdrawals FOR ALL USING (is_admin());

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.withdrawals REPLICA IDENTITY FULL;
