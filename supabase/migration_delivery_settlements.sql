-- Delivery settlements: batch reconciliation between the shop and a delivery
-- partner. One row per "Settle up" the admin performs. It captures the COD cash
-- the partner is holding for the shop and the shop's UPI-order payout owed to
-- the partner, plus the net. The partner then confirms receipt (two-step).
--   net_amount > 0  ⇒ partner pays the shop
--   net_amount < 0  ⇒ shop pays the partner

CREATE TABLE IF NOT EXISTS public.delivery_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_person_id UUID NOT NULL REFERENCES public.profiles(id),
  order_count INTEGER NOT NULL DEFAULT 0,
  cash_to_collect DECIMAL(10,2) NOT NULL DEFAULT 0,  -- partner owes shop (COD cash held, minus their cut)
  upi_payout DECIMAL(10,2) NOT NULL DEFAULT 0,       -- shop owes partner (earnings on UPI orders)
  net_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- admin marked it paid/settled
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ                            -- partner confirmed receipt
);

-- Link each settled order back to its settlement batch. Unsettled delivered
-- delivery orders are those with settlement_id IS NULL.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES public.delivery_settlements(id);

CREATE INDEX IF NOT EXISTS idx_orders_settlement ON public.orders(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlements_partner ON public.delivery_settlements(delivery_person_id);

ALTER TABLE public.delivery_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partner views own settlements" ON public.delivery_settlements;
CREATE POLICY "Partner views own settlements" ON public.delivery_settlements
  FOR SELECT USING (delivery_person_id = auth.uid());

DROP POLICY IF EXISTS "Staff manage settlements" ON public.delivery_settlements;
CREATE POLICY "Staff manage settlements" ON public.delivery_settlements
  FOR ALL USING (public.is_staff());

-- Realtime so the partner's page reflects a new settlement / confirmation live.
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_settlements;
