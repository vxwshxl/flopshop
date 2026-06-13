-- ============================================================
-- WALLETS / STORE CREDIT + DEVELOPER SETTLEMENTS
-- Run in the Supabase SQL editor (idempotent — safe to re-run).
--
-- A wallet holds store credit for EITHER a login account (profiles) OR a
-- walk-in customer (customers). Credit is parked when the shop can't make
-- change, topped up by handing over cash/UPI, or spent via "Pay by credit".
-- The ledger (wallet_transactions) records every movement; wallet.balance is
-- the running total kept in sync atomically by wallet_adjust().
-- ============================================================

-- WALLETS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Exactly one owner: a profile XOR a walk-in customer.
  CONSTRAINT wallet_one_owner CHECK ((profile_id IS NOT NULL) <> (customer_id IS NOT NULL))
);

-- One wallet per owner.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_profile ON public.wallets(profile_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_customer ON public.wallets(customer_id) WHERE customer_id IS NOT NULL;

-- WALLET TRANSACTIONS (ledger) ---------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,            -- signed: + credit, - debit
  balance_after DECIMAL(10,2) NOT NULL,     -- running balance snapshot
  type TEXT NOT NULL CHECK (type IN ('change', 'topup', 'order_payment', 'refund', 'adjustment')),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet ON public.wallet_transactions(wallet_id, created_at DESC);

-- WALLET TOP-UP REQUESTS (login accounts only) -----------------
CREATE TABLE IF NOT EXISTS public.wallet_topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'upi')),
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topups_status ON public.wallet_topup_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topups_profile ON public.wallet_topup_requests(profile_id, created_at DESC);

-- ============================================================
-- WALLET HELPERS
-- ============================================================

-- Returns the wallet id for an owner, creating it on first touch. Exactly one
-- of the two args must be non-null (matches the wallet_one_owner constraint).
CREATE OR REPLACE FUNCTION public.wallet_get_or_create(
  p_profile_id UUID,
  p_customer_id UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF (p_profile_id IS NOT NULL) = (p_customer_id IS NOT NULL) THEN
    RAISE EXCEPTION 'wallet_get_or_create needs exactly one owner';
  END IF;

  IF p_profile_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.wallets WHERE profile_id = p_profile_id;
    IF v_id IS NULL THEN
      INSERT INTO public.wallets (profile_id) VALUES (p_profile_id)
      ON CONFLICT (profile_id) WHERE profile_id IS NOT NULL DO NOTHING
      RETURNING id INTO v_id;
      IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.wallets WHERE profile_id = p_profile_id;
      END IF;
    END IF;
  ELSE
    SELECT id INTO v_id FROM public.wallets WHERE customer_id = p_customer_id;
    IF v_id IS NULL THEN
      INSERT INTO public.wallets (customer_id) VALUES (p_customer_id)
      ON CONFLICT (customer_id) WHERE customer_id IS NOT NULL DO NOTHING
      RETURNING id INTO v_id;
      IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.wallets WHERE customer_id = p_customer_id;
      END IF;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- Atomically moves money on a wallet and records a ledger row. p_amount is
-- signed (+ credit, - debit). A debit that would push the balance below 0 is
-- rejected. Locks the wallet row FOR UPDATE so concurrent spends can't oversell
-- credit (mirrors record_purchase_cost's locking).
CREATE OR REPLACE FUNCTION public.wallet_adjust(
  p_wallet_id UUID,
  p_amount DECIMAL,
  p_type TEXT,
  p_order_id UUID,
  p_note TEXT,
  p_actor UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance DECIMAL(10,2);
  v_new DECIMAL(10,2);
BEGIN
  SELECT balance INTO v_balance FROM public.wallets WHERE id = p_wallet_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Wallet not found.');
  END IF;

  v_new := v_balance + p_amount;
  IF v_new < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient credit balance.');
  END IF;

  UPDATE public.wallets SET balance = v_new, updated_at = NOW() WHERE id = p_wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, amount, balance_after, type, order_id, note, created_by)
  VALUES (p_wallet_id, p_amount, v_new, p_type, p_order_id, NULLIF(p_note, ''), p_actor);

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Allow 'credit' as an order payment method.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash', 'upi', 'split', 'credit'));

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_topup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner views own wallet" ON public.wallets;
CREATE POLICY "Owner views own wallet" ON public.wallets
  FOR SELECT USING (profile_id = auth.uid());
DROP POLICY IF EXISTS "Staff manage wallets" ON public.wallets;
CREATE POLICY "Staff manage wallets" ON public.wallets
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Owner views own wallet txns" ON public.wallet_transactions;
CREATE POLICY "Owner views own wallet txns" ON public.wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_transactions.wallet_id AND w.profile_id = auth.uid())
  );
DROP POLICY IF EXISTS "Staff manage wallet txns" ON public.wallet_transactions;
CREATE POLICY "Staff manage wallet txns" ON public.wallet_transactions
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Owner views own topups" ON public.wallet_topup_requests;
CREATE POLICY "Owner views own topups" ON public.wallet_topup_requests
  FOR SELECT USING (profile_id = auth.uid());
DROP POLICY IF EXISTS "Owner creates own topups" ON public.wallet_topup_requests;
CREATE POLICY "Owner creates own topups" ON public.wallet_topup_requests
  FOR INSERT WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS "Staff manage topups" ON public.wallet_topup_requests;
CREATE POLICY "Staff manage topups" ON public.wallet_topup_requests
  FOR ALL USING (public.is_staff());

-- ============================================================
-- REALTIME — owners/admin see balance & request changes live.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_topup_requests;
ALTER TABLE public.wallets REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_topup_requests REPLICA IDENTITY FULL;

-- ============================================================
-- DEVELOPER SETTLEMENTS
-- The developer's share is 10% of profit (item margin + the shop's delivery
-- share). It's a pure calculation — no per-order column. A settlement snapshots
-- the outstanding share and a `settled_through` cutoff; outstanding share is
-- then computed only over orders created AFTER the latest settlement.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.developer_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,         -- share settled in this batch
  profit_base DECIMAL(10,2) NOT NULL DEFAULT 0,    -- the profit the share was 10% of
  settled_through TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- cutoff: orders up to here are settled
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_settlements_through ON public.developer_settlements(settled_through DESC);

ALTER TABLE public.developer_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage developer settlements" ON public.developer_settlements;
CREATE POLICY "Admin manage developer settlements" ON public.developer_settlements
  FOR ALL USING (public.is_admin());
