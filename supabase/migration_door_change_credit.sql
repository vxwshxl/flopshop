-- "No change at the door": let a delivery partner settle the difference on a
-- cash order into the customer's wallet instead of hunting for coins.
--
-- The customer hands over whatever they have. Anything above the order total is
-- parked as store credit; anything below becomes a small debt they settle later
-- (wallets already go negative — see migration_wallet_negative.sql).
--
-- The order total deliberately does NOT move: subtotal / total_amount feed the
-- revenue, gross-profit and shareholder-split figures on the Reports page, and
-- a ₹15 rounding at the door is not revenue. So the cash actually handed over is
-- recorded separately here, and only the partner-settlement math reads it —
-- a partner who collected ₹100 on an ₹85 order owes the shop ₹100 less their cut.
--
-- NULL means "exactly the order total", which is the normal case for every
-- existing and future order; only rows that were rounded carry a value.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cash_collected DECIMAL(10,2);

COMMENT ON COLUMN public.orders.cash_collected IS
  'Cash actually handed over at the door on a cash order, when it differed from total_amount (the difference went to/from the customer wallet). NULL = exactly total_amount. Drives delivery-partner settlement, never revenue.';
