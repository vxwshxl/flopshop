-- ============================================================
-- Allow the new 'withdrawal' movement type (cash paid out of the wallet).
-- Extends the type CHECK constraint that was last set in
-- migration_wallet_history.sql.
-- ============================================================
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('change', 'topup', 'order_payment', 'refund', 'adjustment', 'withdrawal', 'transfer'));
