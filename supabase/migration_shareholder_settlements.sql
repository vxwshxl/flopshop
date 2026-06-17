-- ============================================================
-- SHAREHOLDER PROFIT SETTLEMENTS
-- Distributes the shop's outstanding profit pool (item margin + the shop's
-- delivery share) among the three shareholders — Philip 50%, Zau 40%, Vee 10%.
-- Each settlement snapshots the pool accrued since the last settlement's
-- `settled_through` cutoff and records the per-shareholder amounts + timestamp,
-- which effectively resets the outstanding balance to zero. Idempotent.
--
-- NOTE: Vee's 10% here IS the old "developer share" — this table supersedes
-- developer_settlements, which is now legacy.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profit_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The profit pool that was distributed in this settlement.
  profit_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Orders created up to this cutoff are settled; the balance resets here.
  settled_through TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Per-shareholder amounts (stored so historical splits survive rate changes).
  philip_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  zau_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  vee_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profit_settlements_through ON public.profit_settlements(settled_through DESC);

ALTER TABLE public.profit_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage profit settlements" ON public.profit_settlements;
CREATE POLICY "Admin manage profit settlements" ON public.profit_settlements FOR ALL USING (is_admin());

-- Realtime so the Shareholders page reflects new settlements live.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profit_settlements; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.profit_settlements REPLICA IDENTITY FULL;
