-- Allow a wallet to go negative (the customer owes the shop) when the caller
-- opts in. Admin-initiated movements — manually deducting more credit than the
-- balance, or settling an order onto a customer's tab — pass p_allow_negative
-- TRUE. Customer self-spend at checkout keeps the default FALSE, so a shopper
-- still can't overdraw their own store credit.
--
-- Adding a parameter changes the function signature, so the old 6-arg version is
-- dropped first (CREATE OR REPLACE can't change the argument list).
DROP FUNCTION IF EXISTS public.wallet_adjust(UUID, DECIMAL, TEXT, UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.wallet_adjust(
  p_wallet_id UUID,
  p_amount DECIMAL,
  p_type TEXT,
  p_order_id UUID,
  p_note TEXT,
  p_actor UUID,
  p_allow_negative BOOLEAN DEFAULT FALSE
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

  INSERT INTO public.wallet_transactions (wallet_id, amount, balance_after, type, order_id, note, created_by)
  VALUES (p_wallet_id, p_amount, v_new, p_type, p_order_id, NULLIF(p_note, ''), p_actor);

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
