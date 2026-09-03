-- A product can sit in more than one category (Snickers is both "Chocolates and
-- Sweets" and "Snacks"). The extra memberships live in a join table.
--
-- products.category_id stays as the PRIMARY category and is deliberately kept:
-- sales reports attribute each order line to exactly one category, and a product
-- in three of them would otherwise triple-count revenue. It is also the label
-- shown on the product row and the store card.
--
-- The join table holds the FULL set including the primary, so browsing/filtering
-- is a single lookup and never has to union the two sources.

CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id  UUID NOT NULL REFERENCES public.products(id)   ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, category_id)
);

-- Filtering the store by a category reads this the other way round.
CREATE INDEX IF NOT EXISTS product_categories_category_idx
  ON public.product_categories (category_id);

-- Backfill: every product's existing single category becomes its first row.
INSERT INTO public.product_categories (product_id, category_id)
SELECT id, category_id FROM public.products WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Mirrors the products policies: readable by anyone who can see the shop,
-- writable only by an admin.
DROP POLICY IF EXISTS "Anyone can view product categories" ON public.product_categories;
CREATE POLICY "Anyone can view product categories"
  ON public.product_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manages product categories" ON public.product_categories;
CREATE POLICY "Admin manages product categories"
  ON public.product_categories FOR ALL USING (public.is_admin());

-- The store grid refreshes on realtime product changes; membership changes have
-- to reach it the same way or a re-categorised product stays under the old chip.
ALTER TABLE public.product_categories REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.product_categories; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
