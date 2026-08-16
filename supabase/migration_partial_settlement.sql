-- ============================================================
-- PARTIAL SHAREHOLDER SETTLEMENTS
-- A settlement may pay out LESS than the holder's outstanding balance (e.g.
-- settle ₹800 of ₹842.82 and leave the ₹42.82 change in their share).
-- Because the outstanding balance is derived from the `settled_through` cutoff
-- alone, the unpaid remainder would otherwise vanish when the cutoff moves — so
-- each settlement records what it left behind in `carry_forward`.
--
-- Outstanding for a holder = (their % of profit since their latest cutoff)
--                          + that latest settlement's `carry_forward`.
-- Reversing a settlement restores the previous row's cutoff and carry, so the
-- balance stays correct without any backfill.
-- ============================================================
ALTER TABLE public.shareholder_settlements
  ADD COLUMN IF NOT EXISTS carry_forward DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.shareholder_settlements.carry_forward IS
  'Outstanding amount deliberately left unpaid at this cutoff; rolls into the holder''s next balance.';
