-- Sub-categories. Chips, "Bread, Pies & Biscuits" and "Chocolates and Sweets"
-- are all kinds of Snacks, so they become children of it — and anything filed
-- under a child now also counts as belonging to the parent.
--
-- Run AFTER migration_product_categories.sql (this builds on that join table).

-- 1) The tree ------------------------------------------------------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS categories_parent_idx ON public.categories (parent_id);

-- Matched by slug rather than a hard-coded UUID so this runs anywhere.
UPDATE public.categories
   SET parent_id = (SELECT id FROM public.categories WHERE slug = 'snacks')
 WHERE slug IN ('chips', 'bread-pies-biscuits', 'chocolates-and-sweets')
   AND parent_id IS DISTINCT FROM (SELECT id FROM public.categories WHERE slug = 'snacks');

-- 2) Membership in a child implies membership in its ancestors ------
-- Kept as real rows rather than resolved at read time: the store, the admin
-- filter and the product counts all read product_categories directly, so one
-- expansion here keeps every one of them right without a join per query.
CREATE OR REPLACE FUNCTION public.add_product_category_ancestors()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_categories (product_id, category_id)
  SELECT NEW.product_id, a.id FROM (
    WITH RECURSIVE up AS (
      SELECT c.id, c.parent_id, 1 AS depth
        FROM public.categories c
       WHERE c.id = NEW.category_id
      UNION ALL
      -- depth caps the walk so a mis-set parent can't spin forever.
      SELECT p.id, p.parent_id, up.depth + 1
        FROM public.categories p
        JOIN up ON p.id = up.parent_id
       WHERE up.depth < 10
    )
    SELECT id FROM up WHERE id <> NEW.category_id
  ) a
  ON CONFLICT DO NOTHING;
  -- Each inserted ancestor fires this trigger again, but by then its own
  -- ancestors are already there and ON CONFLICT stops the chain.
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_categories_ancestors ON public.product_categories;
CREATE TRIGGER product_categories_ancestors
  AFTER INSERT ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.add_product_category_ancestors();

-- 3) Backfill what's already filed ---------------------------------
-- Every product currently in Chips / Bread / Chocolates picks up Snacks too.
-- Re-runnable: ON CONFLICT makes it a no-op the second time.
WITH RECURSIVE tree AS (
  SELECT pc.product_id, c.id AS category_id, c.parent_id, 1 AS depth
    FROM public.product_categories pc
    JOIN public.categories c ON c.id = pc.category_id
  UNION ALL
  SELECT t.product_id, p.id, p.parent_id, t.depth + 1
    FROM public.categories p
    JOIN tree t ON p.id = t.parent_id
   WHERE t.depth < 10
)
INSERT INTO public.product_categories (product_id, category_id)
SELECT DISTINCT product_id, category_id FROM tree
ON CONFLICT DO NOTHING;

-- 4) Re-parenting later --------------------------------------------
-- Moving a category under a new parent doesn't retro-fill its products, so
-- expose the backfill as a function an admin can call after a change.
-- (It never REMOVES a membership — dropping a parent link leaves the products
-- where they are, which an admin can undo per product if that's not wanted.)
CREATE OR REPLACE FUNCTION public.sync_category_ancestors()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_added INTEGER;
BEGIN
  WITH RECURSIVE tree AS (
    SELECT pc.product_id, c.id AS category_id, c.parent_id, 1 AS depth
      FROM public.product_categories pc
      JOIN public.categories c ON c.id = pc.category_id
    UNION ALL
    SELECT t.product_id, p.id, p.parent_id, t.depth + 1
      FROM public.categories p
      JOIN tree t ON p.id = t.parent_id
     WHERE t.depth < 10
  ), ins AS (
    INSERT INTO public.product_categories (product_id, category_id)
    SELECT DISTINCT product_id, category_id FROM tree
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_added FROM ins;
  RETURN v_added;
END;
$$;
