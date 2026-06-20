-- ============================================================
-- WALLET / STORE-CREDIT HISTORY ENRICHMENT + USER-TO-USER TRANSFERS
-- Run in the Supabase SQL editor (idempotent — safe to re-run).
--
-- Adds to the wallet_transactions ledger:
--   * method               — HOW credit moved (cash / upi / bank / transfer / other)
--   * counterparty_wallet_id — the other wallet in a transfer
--   * transfer_group       — links the two legs (debit + credit) of one transfer
-- And the new movement type 'transfer' so credit can be moved between two wallets
-- (admin-initiated, or a user sending credit to another user). created_by already
-- records WHICH admin/user performed every movement — now surfaced in the UI.
-- ============================================================

-- New ledger columns -------------------------------------------
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS method TEXT
    CHECK (method IS NULL OR method IN ('cash', 'upi', 'bank', 'transfer', 'other'));
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS counterparty_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL;
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS transfer_group UUID;

CREATE INDEX IF NOT EXISTS idx_wallet_txns_transfer_group ON public.wallet_transactions(transfer_group) WHERE transfer_group IS NOT NULL;

-- Allow the new 'transfer' movement type. The constraint is auto-named
-- wallet_transactions_type_check by its inline definition in migration_wallets.sql.
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('change', 'topup', 'order_payment', 'refund', 'adjustment', 'transfer'));

-- ============================================================
-- wallet_adjust — now records the payment method.
-- Adding p_method changes the signature, so drop the old 7-arg version first
-- (CREATE OR REPLACE can't change the argument list).
-- ============================================================
DROP FUNCTION IF EXISTS public.wallet_adjust(UUID, DECIMAL, TEXT, UUID, TEXT, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.wallet_adjust(
  p_wallet_id UUID,
  p_amount DECIMAL,
  p_type TEXT,
  p_order_id UUID,
  p_note TEXT,
  p_actor UUID,
  p_allow_negative BOOLEAN DEFAULT FALSE,
  p_method TEXT DEFAULT NULL
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
  IF v_new < 0 AND NOT p_allow_negative THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient credit balance.');
  END IF;

  UPDATE public.wallets SET balance = v_new, updated_at = NOW() WHERE id = p_wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, amount, balance_after, type, order_id, note, created_by, method)
  VALUES (p_wallet_id, p_amount, v_new, p_type, p_order_id, NULLIF(p_note, ''), p_actor, p_method);

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- wallet_transfer — atomically move credit from one wallet to another.
-- Writes two balanced ledger legs (a 'transfer' debit on the source and credit
-- on the destination) sharing a transfer_group and pointing at each other via
-- counterparty_wallet_id. Both wallet rows are locked FOR UPDATE in a
-- deterministic id order so concurrent transfers can't deadlock. The source may
-- be allowed to go negative (admin moves); user-to-user sends pass FALSE so a
-- shopper can't overdraw their own credit.
-- ============================================================
CREATE OR REPLACE FUNCTION public.wallet_transfer(
  p_from_wallet UUID,
  p_to_wallet UUID,
  p_amount DECIMAL,
  p_actor UUID,
  p_note TEXT,
  p_allow_negative BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_from DECIMAL(10,2);
  v_to DECIMAL(10,2);
  v_from_new DECIMAL(10,2);
  v_to_new DECIMAL(10,2);
  v_group UUID := gen_random_uuid();
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter an amount greater than 0.');
  END IF;
  IF p_from_wallet = p_to_wallet THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot transfer to the same wallet.');
  END IF;

  -- Lock both rows in a stable order to avoid deadlocking with another transfer.
  IF p_from_wallet < p_to_wallet THEN
    SELECT balance INTO v_from FROM public.wallets WHERE id = p_from_wallet FOR UPDATE;
    SELECT balance INTO v_to   FROM public.wallets WHERE id = p_to_wallet   FOR UPDATE;
  ELSE
    SELECT balance INTO v_to   FROM public.wallets WHERE id = p_to_wallet   FOR UPDATE;
    SELECT balance INTO v_from FROM public.wallets WHERE id = p_from_wallet FOR UPDATE;
  END IF;

  IF v_from IS NULL OR v_to IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Wallet not found.');
  END IF;

  v_from_new := v_from - p_amount;
  IF v_from_new < 0 AND NOT p_allow_negative THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient credit balance.');
  END IF;
  v_to_new := v_to + p_amount;

  UPDATE public.wallets SET balance = v_from_new, updated_at = NOW() WHERE id = p_from_wallet;
  UPDATE public.wallets SET balance = v_to_new,   updated_at = NOW() WHERE id = p_to_wallet;

  INSERT INTO public.wallet_transactions
    (wallet_id, amount, balance_after, type, note, created_by, method, counterparty_wallet_id, transfer_group)
  VALUES
    (p_from_wallet, -p_amount, v_from_new, 'transfer', NULLIF(p_note, ''), p_actor, 'transfer', p_to_wallet, v_group),
    (p_to_wallet,    p_amount, v_to_new,   'transfer', NULLIF(p_note, ''), p_actor, 'transfer', p_from_wallet, v_group);

  RETURN jsonb_build_object('ok', true, 'from_balance', v_from_new, 'to_balance', v_to_new);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
