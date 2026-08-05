-- Free-delivery promo -------------------------------------------------------
-- Delivery orders whose goods total reaches `free_delivery_min` ship free for
-- the customer. The delivery person is still paid their usual share, so the
-- shop's `admin_delivery_earning` on those orders goes negative by that amount
-- — the promo is funded out of the shop's profit, and shows up that way in
-- Reports and the shareholder profit pool.
--
-- `free_delivery_min`   subtotal (before the fee) that qualifies. '0' = off.
-- `free_delivery_until` last day it runs, IST YYYY-MM-DD, inclusive.
--                       Blank = no end date.
--
-- Both are editable from Admin → Settings → Free Delivery Promo. The app falls
-- back to these same values via DEFAULT_SETTINGS, so it behaves correctly even
-- before this migration is applied — running it just makes the rows editable.

INSERT INTO settings (key, value, label) VALUES
  ('free_delivery_min', '299', 'Free Delivery Over (₹)'),
  ('free_delivery_until', '2026-08-12', 'Free Delivery Promo Ends (IST)')
ON CONFLICT (key) DO NOTHING;
