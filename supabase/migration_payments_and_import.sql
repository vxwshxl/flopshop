-- ============================================================
-- Dynamic payment methods  +  old-sales import (staging → orders)
-- Run in the Supabase SQL editor. Idempotent / safe to re-run.
-- ============================================================

-- ─────────────────────────────────────────────
-- PART 1 — Dynamic, admin-managed payment methods
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.payment_methods (name, sort_order) VALUES
  ('Cash', 1), ('UPI', 2), ('Bank Transfer', 3), ('Split', 4), ('Other', 5)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active payment methods" ON public.payment_methods;
CREATE POLICY "Anyone can view active payment methods" ON public.payment_methods
  FOR SELECT USING (is_active = true OR is_admin());
DROP POLICY IF EXISTS "Admin manages payment methods" ON public.payment_methods;
CREATE POLICY "Admin manages payment methods" ON public.payment_methods
  FOR ALL USING (is_admin());

-- Orders can now store any method name (Cash / UPI / Bank Transfer / Other …),
-- so drop the old fixed check. Existing 'cash'/'upi'/'split' values stay valid.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

-- ─────────────────────────────────────────────
-- PART 2 — Old-sales import
-- ─────────────────────────────────────────────

-- 2a) Staging table — mirrors your spreadsheet columns exactly.
--     Upload the full CSV into this table via Supabase → Table editor → Import.
CREATE TABLE IF NOT EXISTS public.staging_old_sales (
  id TEXT,
  invoice_number TEXT,
  item_id TEXT,
  quantity INTEGER,
  unit_price NUMERIC,
  total_price NUMERIC,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  sale_date TEXT,
  payment_method TEXT,
  status TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT
);

-- ===== RUN THE STEPS BELOW *AFTER* THE CSV IS LOADED INTO staging_old_sales =====

-- 2b) Recurring customers: one row per unique name (case-insensitive).
INSERT INTO public.customers (name, phone)
SELECT DISTINCT trim(s.customer_name), ''
FROM public.staging_old_sales s
WHERE trim(COALESCE(s.customer_name, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE lower(c.name) = lower(trim(s.customer_name))
  );

-- 2c) Orders: one per InvoiceNumber. Historical walk-in sales, already paid &
--     completed. Delivery fee 0; total = sum of its line items.
INSERT INTO public.orders (
  order_number, invoice_number, customer_name, order_type, status,
  subtotal, delivery_fee, total_amount, payment_method, payment_status,
  notes, is_manual, created_at, updated_at
)
SELECT
  s.invoice_number,
  s.invoice_number,
  COALESCE(NULLIF(trim(MAX(s.customer_name)), ''), 'Walk-in'),
  'pickup',
  'delivered',
  SUM(s.total_price),
  0,
  SUM(s.total_price),
  COALESCE(NULLIF(trim(MAX(s.payment_method)), ''), 'Other'),
  'paid',
  NULLIF(trim(MAX(s.notes)), ''),
  true,
  MIN(to_timestamp(s.created_at, 'DD/MM/YYYY HH24:MI:SS')),
  MIN(to_timestamp(s.created_at, 'DD/MM/YYYY HH24:MI:SS'))
FROM public.staging_old_sales s
WHERE s.invoice_number IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.invoice_number = s.invoice_number)
GROUP BY s.invoice_number;

-- 2d) Order items: one per staging row. Product name + cost looked up from the
--     live products table; tolerant if an old item no longer exists.
INSERT INTO public.order_items (
  order_id, product_id, product_name, quantity, unit_price, total_price, cost_price
)
SELECT
  o.id,
  p.id,                                   -- NULL when the product is gone
  COALESCE(p.name, 'Imported item'),
  s.quantity,
  s.unit_price,
  s.total_price,
  COALESCE(p.cost_price, 0)               -- cost snapshot (current cost)
FROM public.staging_old_sales s
JOIN public.orders o
  ON o.invoice_number = s.invoice_number
LEFT JOIN public.products p
  ON p.id = (CASE WHEN s.item_id ~* '^[0-9a-f-]{36}$' THEN s.item_id::uuid END)
WHERE o.is_manual = true
  -- guard so re-running doesn't duplicate items for already-imported orders
  AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id);

-- 2e) (Optional) once you've confirmed the import looks right:
-- DROP TABLE public.staging_old_sales;
