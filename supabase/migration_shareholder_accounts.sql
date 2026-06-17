-- ============================================================
-- PER-SHAREHOLDER SETTLEMENTS + LINKED ACCOUNTS + CONFIRMATION
-- Each shareholder is settled independently at their own time (their own
-- cutoff), can be linked to an app user account, and confirms a settlement as
-- received from their own account. Supersedes the global profit_settlements /
-- profit_settlement_shares model. Idempotent — safe to re-run.
-- ============================================================

-- Link a shareholder to an app user account (so they can see & confirm payouts).
ALTER TABLE public.shareholders
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shareholders_profile ON public.shareholders(profile_id);

-- One settlement = one payout to one shareholder, with that holder's own cutoff.
CREATE TABLE IF NOT EXISTS public.shareholder_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- snapshot at settle time
  type TEXT,
  share_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  profit_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  settled_through TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- this holder's cutoff
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  confirmed_at TIMESTAMPTZ,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shareholder_settlements_holder
  ON public.shareholder_settlements(shareholder_id, settled_through DESC);

ALTER TABLE public.shareholder_settlements ENABLE ROW LEVEL SECURITY;

-- Admins manage everything.
DROP POLICY IF EXISTS "Admin manage shareholder settlements" ON public.shareholder_settlements;
CREATE POLICY "Admin manage shareholder settlements" ON public.shareholder_settlements FOR ALL USING (is_admin());

-- A linked shareholder can read their own settlements …
DROP POLICY IF EXISTS "Shareholder reads own settlements" ON public.shareholder_settlements;
CREATE POLICY "Shareholder reads own settlements" ON public.shareholder_settlements FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.shareholders s
    WHERE s.id = shareholder_settlements.shareholder_id AND s.profile_id = auth.uid()
  )
);

-- … and confirm them (update is gated to their own rows; status flip enforced server-side).
DROP POLICY IF EXISTS "Shareholder confirms own settlements" ON public.shareholder_settlements;
CREATE POLICY "Shareholder confirms own settlements" ON public.shareholder_settlements FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.shareholders s
    WHERE s.id = shareholder_settlements.shareholder_id AND s.profile_id = auth.uid()
  )
);

-- A linked shareholder can read their own roster row (for their portal view).
DROP POLICY IF EXISTS "Shareholder reads own roster row" ON public.shareholders;
CREATE POLICY "Shareholder reads own roster row" ON public.shareholders FOR SELECT USING (profile_id = auth.uid());

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shareholder_settlements; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.shareholder_settlements REPLICA IDENTITY FULL;

-- The old global model is replaced; its tables are left in place but unused and
-- may be dropped once you've confirmed the new flow:
--   DROP TABLE IF EXISTS public.profit_settlement_shares;
--   DROP TABLE IF EXISTS public.profit_settlements;
