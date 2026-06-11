-- Partial payments: track how much of an order has actually been collected, so
-- "paid half now, rest later" is representable. payment_status gains 'partial'.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'paid', 'partial'));

-- Backfill: existing paid orders count their full total as collected.
UPDATE public.orders SET amount_paid = total_amount WHERE payment_status = 'paid' AND amount_paid = 0;
