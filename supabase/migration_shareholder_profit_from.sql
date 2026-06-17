-- ============================================================
-- PER-SHAREHOLDER PROFIT START FLOOR
-- A shareholder can be limited to profit from a given date onward (e.g. the
-- developer joined later and only earns from 10 Jun 2026). Holders with NULL
-- profit_from earn on all-time profit. Idempotent — safe to re-run.
-- ============================================================
ALTER TABLE public.shareholders ADD COLUMN IF NOT EXISTS profit_from DATE;

-- The developer's share only counts profit from when the fee started.
UPDATE public.shareholders
SET profit_from = '2026-06-10'
WHERE lower(coalesce(type, '')) = 'developer' AND profit_from IS NULL;
