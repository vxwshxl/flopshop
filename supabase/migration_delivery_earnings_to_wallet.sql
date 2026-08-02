-- Delivery earnings now land in the partner's store-credit wallet instead of
-- being paid out in cash/UPI at settlement time.
--
-- Before: the partner kept their cut out of the COD cash they held, and the shop
--   paid them their cut on UPI-paid orders (upi_payout).
-- After:  the partner hands over the FULL cash they collected at the door, and
--   every earning — cash orders and UPI orders alike — is credited to their
--   wallet. They draw it down later through the normal withdrawal flow.
--
-- `upi_payout` stays on the table so historical settlements keep reading
-- correctly; new rows write 0 there and put the earnings in `wallet_credited`.

ALTER TABLE public.delivery_settlements
  ADD COLUMN IF NOT EXISTS wallet_credited DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.delivery_settlements.wallet_credited IS
  'Partner earnings credited to their wallet in this batch (replaces upi_payout for new settlements).';
