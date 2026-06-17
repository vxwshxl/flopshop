-- ============================================================
-- DYNAMIC SHAREHOLDERS
-- Moves the shareholder roster (name, type, share %) out of code and into a
-- table so it can be edited at runtime. Each settlement snapshots the roster
-- into profit_settlement_shares so historical splits stay correct even after
-- the roster changes. Idempotent — safe to re-run.
--
-- Supersedes the fixed philip/zau/vee columns on profit_settlements.
-- ============================================================

-- Roster of shareholders. share_percent across active rows should sum to 100.
CREATE TABLE IF NOT EXISTS public.shareholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT,                                   -- e.g. founder / investor / developer
  share_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shareholders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage shareholders" ON public.shareholders;
CREATE POLICY "Admin manage shareholders" ON public.shareholders FOR ALL USING (is_admin());
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shareholders; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.shareholders REPLICA IDENTITY FULL;

-- Seed the existing split once (only when the roster is empty).
INSERT INTO public.shareholders (name, type, share_percent, sort_order)
SELECT v.name, v.type, v.pct, v.ord
FROM (VALUES
  ('Philip', 'founder',   50.0::numeric, 0),
  ('Zau',    'founder',   40.0::numeric, 1),
  ('Vee',    'developer', 10.0::numeric, 2)
) AS v(name, type, pct, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.shareholders);

-- Per-settlement snapshot of who got what.
CREATE TABLE IF NOT EXISTS public.profit_settlement_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.profit_settlements(id) ON DELETE CASCADE,
  shareholder_id UUID REFERENCES public.shareholders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,                          -- snapshot of shareholder at settle time
  type TEXT,
  share_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_settlement_shares_settlement ON public.profit_settlement_shares(settlement_id);

ALTER TABLE public.profit_settlement_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage settlement shares" ON public.profit_settlement_shares;
CREATE POLICY "Admin manage settlement shares" ON public.profit_settlement_shares FOR ALL USING (is_admin());
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profit_settlement_shares; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.profit_settlement_shares REPLICA IDENTITY FULL;

-- The fixed per-name columns are replaced by the snapshot child table.
ALTER TABLE public.profit_settlements
  DROP COLUMN IF EXISTS philip_amount,
  DROP COLUMN IF EXISTS zau_amount,
  DROP COLUMN IF EXISTS vee_amount;
