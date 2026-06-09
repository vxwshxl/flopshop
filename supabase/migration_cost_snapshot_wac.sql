-- ============================================================
-- FINAL CONSOLIDATED MIGRATION
-- Cost/selling-price snapshots + weighted-average cost + order editing.
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================

-- 1) order_items now carries the COST that was true when the order was placed.
--    (Selling price was already snapshotted via unit_price / total_price.)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill existing rows from the product's current cost so reports read the
-- same right now as before. From here on, editing a product's cost/price no
-- longer touches these locked-in values.
UPDATE public.order_items oi
SET cost_price = p.cost_price
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.cost_price = 0;

-- 1b) Split payments: allow 'split' and record how much was paid each way.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cash', 'upi', 'split'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_cash DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_upi  DECIMAL(10,2) DEFAULT 0;

-- 2) checkout_order: persist the cost snapshot + split amounts for new orders.
CREATE OR REPLACE FUNCTION public.checkout_order(
  p_order JSONB,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_new_stock INTEGER;
  v_order_id UUID;
  v_status TEXT;
  v_is_confirm BOOLEAN;
BEGIN
  v_status := p_order->>'status';
  v_is_confirm := (v_status = 'confirmed');

  IF v_is_confirm THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;

      UPDATE public.products
      SET current_stock = current_stock - v_quantity,
          updated_at = NOW()
      WHERE id = v_product_id
      RETURNING current_stock INTO v_new_stock;

      IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient stock for product ID %', v_product_id;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.orders (
    order_number, invoice_number, user_id, customer_name, customer_phone, customer_room,
    order_type, status, subtotal, delivery_fee, delivery_person_earning, admin_delivery_earning,
    total_amount, payment_method, paid_cash, paid_upi, notes, is_manual, otp_code
  ) VALUES (
    p_order->>'order_number',
    p_order->>'invoice_number',
    NULLIF(p_order->>'user_id', '')::UUID,
    p_order->>'customer_name',
    NULLIF(p_order->>'customer_phone', ''),
    NULLIF(p_order->>'customer_room', ''),
    p_order->>'order_type',
    p_order->>'status',
    (p_order->>'subtotal')::DECIMAL,
    (p_order->>'delivery_fee')::DECIMAL,
    (p_order->>'delivery_person_earning')::DECIMAL,
    (p_order->>'admin_delivery_earning')::DECIMAL,
    (p_order->>'total_amount')::DECIMAL,
    p_order->>'payment_method',
    COALESCE((p_order->>'paid_cash')::DECIMAL, 0),
    COALESCE((p_order->>'paid_upi')::DECIMAL, 0),
    NULLIF(p_order->>'notes', ''),
    (p_order->>'is_manual')::BOOLEAN,
    p_order->>'otp_code'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id, product_id, product_name, quantity, unit_price, total_price, cost_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'total_price')::DECIMAL,
      COALESCE((v_item->>'cost_price')::DECIMAL, 0)
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- 3) Weighted-average cost: on each purchase, roll the product's cost into a
--    moving average of existing inventory and the incoming lot:
--      new_cost = (old_stock*old_cost + new_qty*new_unit_cost) / (old_stock + new_qty)
CREATE OR REPLACE FUNCTION public.record_purchase_cost(
  p_product_id UUID,
  p_qty INTEGER,
  p_unit_cost DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_stock INTEGER;
  v_old_cost DECIMAL(10,2);
  v_base INTEGER;
BEGIN
  SELECT GREATEST(current_stock, 0), cost_price
    INTO v_old_stock, v_old_cost
    FROM public.products WHERE id = p_product_id
    FOR UPDATE;

  v_base := v_old_stock + GREATEST(p_qty, 0);

  UPDATE public.products
  SET current_stock = current_stock + p_qty,
      cost_price = CASE
        WHEN v_base > 0
          THEN ROUND((v_old_stock * v_old_cost + GREATEST(p_qty, 0) * p_unit_cost) / v_base, 2)
        ELSE cost_price
      END,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

-- 4) Recompute an order's totals after its line items are edited (fix "error"
--    orders). Delivery fee is left untouched. RLS already lets staff/admin
--    update orders + order_items, so no policy change is needed.
CREATE OR REPLACE FUNCTION public.recompute_order_totals(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
    FROM public.order_items WHERE order_id = p_order_id;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      total_amount = v_subtotal + COALESCE(delivery_fee, 0),
      updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;
