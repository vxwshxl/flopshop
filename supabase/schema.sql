-- ============================================================
-- FlopShop — Supabase schema
-- Run this in the Supabase SQL editor (one shot).
-- ============================================================

-- PROFILES -----------------------------------------------------
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  room_number TEXT,
  hostel_block TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'delivery', 'admin')),
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HOSTELS --------------------------------------------------
CREATE TABLE hostels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO hostels (name) VALUES ('Heyansh House');

-- SUPPLIERS ------------------------------------------------
CREATE TABLE suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CUSTOMERS (walk-in, no login) ----------------------------
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  room_number TEXT,
  hostel_block TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup.
-- NOTE: schema-qualified + fixed search_path so it works when fired by the
-- auth service (whose search_path does not include public).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- CATEGORIES ---------------------------------------------------
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name, slug, icon, color, sort_order) VALUES
  ('Snacks', 'snacks', '🍿', '#f59e0b', 1),
  ('Drinks', 'drinks', '🥤', '#3b82f6', 2),
  ('Noodles', 'noodles', '🍜', '#ef4444', 3);

-- PRODUCTS -----------------------------------------------------
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(10,2) NOT NULL,
  current_stock INTEGER DEFAULT 0,
  minimum_stock INTEGER DEFAULT 5,
  image_url TEXT,
  details JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS -------------------------------------------------------
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_room TEXT,
  order_type TEXT NOT NULL CHECK (order_type IN ('pickup', 'delivery')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  cancel_reason TEXT,
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  delivery_person_earning DECIMAL(10,2) DEFAULT 0,
  admin_delivery_earning DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  delivery_person_id UUID REFERENCES profiles(id),
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'split')),
  -- For split payments: how much of the total was paid by each method.
  paid_cash DECIMAL(10,2) DEFAULT 0,
  paid_upi DECIMAL(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  otp_code TEXT,
  notes TEXT,
  is_manual BOOLEAN DEFAULT false,
  invoice_number TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER ITEMS --------------------------------------------------
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  -- Cost snapshot at order time. Profit reports read THIS, not the live product
  -- cost, so editing a product's cost never rewrites past orders' profit.
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- PURCHASES (inventory restocking by admin) --------------------
CREATE TABLE purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  supplier TEXT,
  purchase_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SETTINGS (dynamic key-value) ---------------------------------
CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  label TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value, label) VALUES
  ('shop_name', 'FlopShop', 'Shop Name'),
  ('shop_tagline', 'Your Hostel Snack Shop', 'Tagline'),
  ('shop_email', '', 'Email'),
  ('shop_phone', '', 'Phone'),
  ('shop_address', '', 'Address'),
  ('delivery_fee', '10', 'Delivery Fee (₹)'),
  ('delivery_person_share', '8', 'Delivery Person Share (₹)'),
  ('admin_delivery_share', '2', 'Admin Share from Delivery (₹)'),
  ('currency_symbol', '₹', 'Currency Symbol'),
  ('min_order_for_delivery', '0', 'Min Order Amount for Delivery'),
  ('shop_is_open', 'true', 'Shop Status');

-- ============================================================
-- STOCK HELPERS (atomic increment / decrement)
-- ============================================================
CREATE OR REPLACE FUNCTION public.adjust_stock(p_product_id UUID, p_delta INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET current_stock = GREATEST(current_stock + p_delta, 0),
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

-- Records a purchase: adds stock AND recomputes the product's cost_price as a
-- weighted moving average of the existing inventory and the incoming lot:
--   new_cost = (old_stock*old_cost + new_qty*new_unit_cost) / (old_stock + new_qty)
-- So the live cost tracks what stock actually cost, while past order_items keep
-- their own cost snapshot (profit history stays put).
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
    -- Validate and deduct stock for all items
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

  -- Insert order
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

  -- Insert items
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

-- Recomputes an order's subtotal/total from its (possibly edited) line items.
-- Used when admins fix a past "error" order; delivery fee is left untouched.
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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin? (avoids recursive policy lookups)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'delivery')); $$;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin full access profiles" ON profiles FOR ALL USING (is_admin());

-- Categories
CREATE POLICY "Anyone can view active categories" ON categories FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY "Admin manages categories" ON categories FOR ALL USING (is_admin());

-- Products
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (is_active = true OR is_staff());
CREATE POLICY "Admin manages products" ON products FOR ALL USING (is_admin());

-- Orders
CREATE POLICY "Users see own orders" ON orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Delivery sees assigned orders" ON orders FOR SELECT USING (delivery_person_id = auth.uid());
CREATE POLICY "Users can create orders" ON orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff full access orders" ON orders FOR ALL USING (is_staff());

-- Order items
CREATE POLICY "Order items inherit order access" ON order_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR o.delivery_person_id = auth.uid() OR is_staff())
  )
);

-- Purchases
CREATE POLICY "Admin manages purchases" ON purchases FOR ALL USING (is_admin());

-- Hostels
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read hostels" ON hostels FOR SELECT USING (true);
CREATE POLICY "Admin manages hostels" ON hostels FOR ALL USING (is_admin());

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read suppliers" ON suppliers FOR SELECT USING (true);
CREATE POLICY "Admin manages suppliers" ON suppliers FOR ALL USING (is_admin());

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages customers" ON customers FOR ALL USING (is_admin());

-- Settings
CREATE POLICY "Public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admin manages settings" ON settings FOR ALL USING (is_admin());

-- ============================================================
-- REALTIME: expose tables the UI reacts to in real time —
-- settings (shop open/closed) and orders (live delivery queue).
-- Without this, postgres_changes events never fire.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE purchases;

-- ============================================================
-- STORAGE: product images bucket (run after creating schema)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admin upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND is_admin());
CREATE POLICY "Admin update product images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND is_admin());
CREATE POLICY "Admin delete product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND is_admin());
