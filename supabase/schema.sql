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
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi')),
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
  total_price DECIMAL(10,2) NOT NULL
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
