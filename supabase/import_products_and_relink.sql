-- ============================================================
-- Import the old products (keep their original IDs) then relink the
-- already-imported order_items so they show real names + cost.
--
-- New products are inserted is_active = FALSE so they don't appear in the
-- live store (they exist only so historical orders can link). If a product
-- ID already exists, it's left untouched (ON CONFLICT DO NOTHING).
--
-- Requires staging_old_sales (from import_old_sales_inline.sql) to still hold
-- the 72 rows. Idempotent.
-- ============================================================

-- ── PART A — products (original IDs; category text → category_id) ──
INSERT INTO public.products
  (id, name, category_id, cost_price, selling_price, current_stock, minimum_stock, image_url, is_active, created_at, updated_at)
SELECT
  p.id::uuid,
  p.name,
  (SELECT c.id FROM public.categories c
     WHERE c.slug = CASE lower(p.cat)
       WHEN 'chips'   THEN 'snacks'
       WHEN 'snack'   THEN 'snacks'
       WHEN 'grocery' THEN 'snacks'
       WHEN 'drinks'  THEN 'drinks'
       WHEN 'noodle'  THEN 'noodles'
       WHEN 'noodles' THEN 'noodles'
       ELSE 'snacks' END
     LIMIT 1),
  p.cost, p.sell, p.stock, COALESCE(p.minstock, 5),
  NULLIF(p.image, ''), false,
  to_timestamp(p.created, 'DD/MM/YYYY HH24:MI:SS'),
  to_timestamp(p.updated, 'DD/MM/YYYY HH24:MI:SS')
FROM (VALUES
('108d9b43-e053-4163-8e43-01f0bed71bd2','Lay''s Shapez crispz herb & onion flavor','Chips',19,20,0,5,'https://drive.google.com/thumbnail?id=1JHOZPAKMpMtuvnyMx61Pp-xZkQrYLBB1','04/06/2026 22:10:50','09/06/2026 01:03:24'),
('f817549d-84a8-43d0-9b17-c4f2e2139411','Lay''s Chile Limon Flavor','Chips',19,20,0,5,'https://drive.google.com/thumbnail?id=1m1_N9HPqxJ3PHz_pPwr_ojhpUjZrSdux','04/06/2026 22:18:09','09/06/2026 21:05:52'),
('7cdc477f-6160-454d-b32f-9fb6bf6a9abe','Kurekure Chilli Chatka','Chips',19,20,3,5,'https://drive.google.com/thumbnail?id=18_aQfpAylEPLf9jyAs4id8joq94z8aA7','04/06/2026 22:20:46','09/06/2026 21:47:31'),
('03f35113-12f7-42a4-b2fd-460bce8270c1','Kurekure Masala Munch','Chips',19,20,1,5,'https://drive.google.com/thumbnail?id=1-qYNLGmBSJUonPHCsCSjTIDyrP689uQ4','04/06/2026 22:23:00','08/06/2026 23:51:40'),
('69c74432-f096-4ff8-be1a-cc042f17ee94','Lay''s American Style Cream & Onion','Chips',19,20,5,5,'https://drive.google.com/thumbnail?id=1My54olZUpO-6YU9hS4H2Dp4IAmidmlS4','04/06/2026 22:29:29','09/06/2026 21:07:16'),
('809887cd-70f5-45cb-b491-8a708c38b2a2','Lay''s Sizzlin'' Hot','Chips',19,20,0,5,'https://drive.google.com/thumbnail?id=1513U5Ku2zLYqgJAV_9t52Dd0vzt1rkw7','04/06/2026 22:31:13','09/06/2026 21:08:43'),
('0553a0cb-c40c-4ad8-9a9e-5fcbc251672f','Lay''s India''s Magic Masala','Chips',19,20,0,1,'https://drive.google.com/thumbnail?id=1tlaMrR64depc9--QZu0C_pk6AdaVGKFB','04/06/2026 22:32:40','09/06/2026 20:58:45'),
('9992c921-3216-4b31-b68d-6993c9195a33','Uncle  Chipps Plain Salted','Chips',19,20,0,5,'https://drive.google.com/thumbnail?id=1DeiHJtUP5cZlV1RqhZN6wk_jZIte2wVQ','04/06/2026 22:35:47','09/06/2026 01:01:55'),
('2ef01b87-b3eb-4406-bd32-4c9c40317f1b','Orion Choco Pie','Snack',8.51,10,43,5,'https://drive.google.com/thumbnail?id=118rLPVimHABIbHHAHxtf9qEHqbT1OAwQ','04/06/2026 22:49:17','09/06/2026 21:37:40'),
('e195e572-0f13-4941-9507-3b72ab7fe853','Bauli Moonfils Croissant with choco creme','Snack',18.75,20,4,5,'https://drive.google.com/thumbnail?id=1GAMzGfjN-359RPJwXWyim2F4_D-cFl8n','04/06/2026 22:51:01','09/06/2026 12:55:09'),
('82d6a480-c3e4-418c-8bf5-75968592fc3d','Di','Grocery',6.66,12,21,5,'','05/06/2026 14:44:26','09/06/2026 19:30:10'),
('df45ce98-f143-4af4-842d-ce105f435e2b','Kurkure Green Chutne Style','Chips',18,20,0,5,'https://drive.google.com/thumbnail?id=1HE7ufy_75doZuTO_e1xTo_GoX9OC5BRs','05/06/2026 22:29:04','08/06/2026 23:39:52'),
('1c6123e1-f7ed-4929-bf86-74238b769f41','Pepsi 300ml','Drinks',39.16,60,1,0,'https://drive.google.com/thumbnail?id=1VtE0sHUyo1G0hCsIZyazlQN5nV-uNHTF','05/06/2026 22:33:00','08/06/2026 23:26:57'),
('135bad36-c75d-442d-ad74-302e4a16764f','Red Bull Energy Drink 250ml','Drinks',115,140,10,0,'https://drive.google.com/thumbnail?id=1a-7kLII7J1oibKUnEQmaeNISuGyOLLF8','06/06/2026 21:28:51','07/06/2026 14:11:39'),
('6ed4d5f4-3a0f-4294-bfa1-299e9e4327a9','Coca-Cola Diet Coke 300ml','Drinks',39.66,60,0,0,'https://drive.google.com/thumbnail?id=1QxS-I1BXH49gINxrUvpAhKqF8mdvdp88','06/06/2026 21:33:37','09/06/2026 21:05:53'),
('124b3c8a-59be-4e2e-8f29-73e691383d6e','Indomie Noodle','Noodle',19.16,30,4,0,'https://drive.google.com/thumbnail?id=1GGWggl2yCyT4jnbKSZ4YOD8uRqKkuHbI','06/06/2026 21:36:17','09/06/2026 21:43:11'),
('c7e15cf2-8e41-4f17-b901-cc7f6bfab244','Geki Ramen','Noodle',51,60,7,0,'https://drive.google.com/thumbnail?id=1rX3lmrVH4-6bly_q5UhKTwOIXsng995x','06/06/2026 21:38:23','09/06/2026 20:53:52'),
('89a6d5cf-fa6b-4a41-ba96-7338a55eb8ad','Bingo mad angles','Chips',17,20,1,0,'','07/06/2026 21:21:22','09/06/2026 20:53:13'),
('29edc5b5-b23a-4b67-8c81-e047aea00a91','wai wai cup noodle','Noodle',42,60,1,0,'','07/06/2026 21:22:07','09/06/2026 21:35:19'),
('08389b88-b6bf-462d-b425-00e3e13855e7','Nissin spiced chicken cup noodle','Noodle',53,60,2,0,'','07/06/2026 21:23:38','08/06/2026 21:43:59'),
('e75f889b-80a0-42e3-bcfc-270b2586f05f','Nissin geki hot and spicy chicken cup noodles','Noodle',76,100,2,0,'','07/06/2026 21:27:13','08/06/2026 21:42:26'),
('d73bb027-242d-4a09-8dc1-000079eb178f','Yu chilli chicken cup noodles','Noodle',48,70,0,0,'','07/06/2026 21:27:57','08/06/2026 22:29:59'),
('03de14e4-c82c-4a00-8333-fa3122c0cea0','Real fruit power apple juice','Drinks',8.5,10,0,5,'','07/06/2026 21:29:40','08/06/2026 01:48:28'),
('62fd161e-3f15-403f-a6ef-7ce941c92d0e','maggi spicy manchurian cup noodles','Noodle',59,70,0,0,'','07/06/2026 21:34:46','08/06/2026 23:57:27'),
('b320f56c-ca37-4d12-8792-83635577eeaa','monster white drink','Drinks',94.67,140,5,NULL,'','08/06/2026 17:44:15','08/06/2026 23:53:37'),
('dc7eef6d-785e-4ba0-aa0a-1294eb611553','indomie fried noodles flavour','Snack',23,30,0,NULL,'','08/06/2026 17:47:09','08/06/2026 22:29:59'),
('f38594d6-4148-45e0-ae4d-315acf35525f','nissin mazedaar masala cup noodle','Snack',48,60,0,NULL,'','08/06/2026 21:32:47','09/06/2026 00:02:31'),
('708cea22-3589-4bb0-ac25-9d1836c5118f','yu chilli manchurian','Snack',42,70,1,NULL,'','08/06/2026 21:34:05','08/06/2026 22:29:58'),
('c480d255-5b07-48af-bc53-de9b87229470','veeba chowmein noodles cup','Snack',46,70,1,NULL,'','08/06/2026 21:36:59','08/06/2026 21:46:07'),
('8858b0e4-643c-4b26-a18a-063fa492e96d','veeba Korean cup noodles','Snack',52,80,1,NULL,'','08/06/2026 21:38:33','08/06/2026 21:46:49'),
('81ba7451-5d11-4f2d-8b7d-89cfa00d3729','maggi masala cuppa noodles','Snack',50,60,1,NULL,'','08/06/2026 21:49:47','08/06/2026 21:52:03'),
('b54017ae-1100-41b6-a2f7-ab0292571574','nissin chilli chilli super hot','Snack',49,60,1,NULL,'','08/06/2026 21:51:00','08/06/2026 21:51:34')
) AS p(id, name, cat, cost, sell, stock, minstock, image, created, updated)
ON CONFLICT (id) DO NOTHING;

-- NOTE: the order_items relink is now handled by import_all_old_sales.sql
-- (it creates its own staging table, builds the orders, and resolves item
-- names from these products). Run that file next.
