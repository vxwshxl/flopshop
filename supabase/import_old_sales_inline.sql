-- ============================================================
-- Direct import of the pasted old sales (72 line items, 26 invoices).
-- Paste & run in the Supabase SQL editor. Idempotent (re-run safe).
-- Requires Part 1 of migration_payments_and_import.sql (payment methods +
-- dropped payment_method check) to have run first.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staging_old_sales (
  id TEXT, invoice_number TEXT, item_id TEXT, quantity INTEGER,
  unit_price NUMERIC, total_price NUMERIC, customer_name TEXT,
  customer_email TEXT, customer_phone TEXT, sale_date TEXT,
  payment_method TEXT, status TEXT, notes TEXT, created_by TEXT, created_at TEXT
);

TRUNCATE public.staging_old_sales;

INSERT INTO public.staging_old_sales
  (id, invoice_number, item_id, quantity, unit_price, total_price, customer_name, sale_date, payment_method, status, notes, created_at)
VALUES
('91c65c49-b9be-404c-9bbb-f9391ff1d13b','INV-260605-078','df45ce98-f143-4af4-842d-ce105f435e2b',2,20,40,'indian','2026-06-05','Other','Completed','bank 50,cash 50','05/06/2026 23:23:01'),
('72822e4d-fab7-49f5-bd5a-d7a5dde1c8dc','INV-260605-078','1c6123e1-f7ed-4929-bf86-74238b769f41',1,60,60,'indian','2026-06-05','Other','Completed','bank 50,cash 50','05/06/2026 23:23:02'),
('49158ba9-a99b-483c-8b05-9146dc9e08a6','INV-260606-035','7cdc477f-6160-454d-b32f-9fb6bf6a9abe',1,20,20,'gala','2026-06-06','Other','Completed','tei','06/06/2026 22:28:21'),
('f90ae72f-e4b4-45fc-a142-60ae9f8e9008','INV-260606-035','e195e572-0f13-4941-9507-3b72ab7fe853',3,20,60,'gala','2026-06-06','Other','Completed','tei','06/06/2026 22:28:21'),
('23b92ee8-7bd1-4c05-aab0-5a4becafb169','INV-260606-039','124b3c8a-59be-4e2e-8f29-73e691383d6e',5,30,150,'divyansh','2026-06-06','Other','Completed','tei','06/06/2026 22:46:56'),
('3827458f-6a44-46d4-a142-e9609bee319a','INV-260606-039','df45ce98-f143-4af4-842d-ce105f435e2b',1,20,20,'divyansh','2026-06-06','Other','Completed','tei','06/06/2026 22:46:56'),
('71865f83-32e8-4e29-af24-cf71188eb4ab','INV-260606-039','e195e572-0f13-4941-9507-3b72ab7fe853',1,20,20,'divyansh','2026-06-06','Other','Completed','tei','06/06/2026 22:46:57'),
('4e554988-55dd-45b4-a899-d34a9137f0fe','INV-260606-039','2ef01b87-b3eb-4406-bd32-4c9c40317f1b',2,10,20,'divyansh','2026-06-06','Other','Completed','tei','06/06/2026 22:47:23'),
('70870d40-b3d8-4598-8922-8d419611b387','INV-260606-050','e195e572-0f13-4941-9507-3b72ab7fe853',1,20,20,'Divyansh','2026-06-06','Other','Completed',NULL,'06/06/2026 23:17:36'),
('9c8ba0ee-61d0-40f2-954e-67e3aa456d73','INV-260606-057','9992c921-3216-4b31-b68d-6993c9195a33',1,20,20,NULL,'2026-06-06','Other','Completed',NULL,'06/06/2026 23:34:19'),
('ad55a1bb-6ac5-4df0-a1a7-5f8f86eb1be9','INV-260606-057','69c74432-f096-4ff8-be1a-cc042f17ee94',2,20,40,NULL,'2026-06-06','Other','Completed',NULL,'06/06/2026 23:34:19'),
('1a64b05c-e6e2-41a5-a6e3-bce0e0e49260','INV-260606-057','e195e572-0f13-4941-9507-3b72ab7fe853',1,20,20,NULL,'2026-06-06','Other','Completed',NULL,'06/06/2026 23:34:20'),
('79fa58de-a2c6-418b-b962-7601cd06b9c2','INV-260606-057','03f35113-12f7-42a4-b2fd-460bce8270c1',1,20,20,NULL,'2026-06-06','Other','Completed',NULL,'06/06/2026 23:34:21'),
('f19afeb8-6a2e-4ef3-89dc-16ce00d4c8b2','INV-260606-061','f817549d-84a8-43d0-9b17-c4f2e2139411',1,20,20,'Jeni','2026-06-06','Other','Completed',NULL,'06/06/2026 23:39:29'),
('5c4f728d-10ac-46ab-9d77-e727a3734cec','INV-260606-061','108d9b43-e053-4163-8e43-01f0bed71bd2',1,20,20,'Jeni','2026-06-06','Other','Completed',NULL,'06/06/2026 23:39:29'),
('5bdca90d-dd1b-4aa6-b22d-801783948d91','INV-260606-063','df45ce98-f143-4af4-842d-ce105f435e2b',1,20,20,'Aiden','2026-06-06','Other','Completed',NULL,'06/06/2026 23:42:15'),
('32eeceab-e954-4888-9838-891a66e667cc','INV-260606-063','6ed4d5f4-3a0f-4294-bfa1-299e9e4327a9',1,60,60,'Aiden','2026-06-06','Other','Completed',NULL,'06/06/2026 23:42:15'),
('d653a6b7-4d1c-4ae1-aaad-deafb4034efc','INV-260607-006','df45ce98-f143-4af4-842d-ce105f435e2b',1,20,20,'Div','2026-06-06','Other','Completed',NULL,'07/06/2026 00:34:04'),
('c7dd2659-4f81-457c-a385-09c262938604','INV-260607-006','108d9b43-e053-4163-8e43-01f0bed71bd2',1,20,20,'Div','2026-06-06','Other','Completed',NULL,'07/06/2026 00:34:04'),
('81434ab7-b82f-46fc-868e-243f5a70095a','INV-260607-006','7cdc477f-6160-454d-b32f-9fb6bf6a9abe',1,20,20,'Div','2026-06-06','Other','Completed',NULL,'07/06/2026 00:34:05'),
('1be6c516-3713-479e-bf96-4978a98c8b17','INV-260607-013','108d9b43-e053-4163-8e43-01f0bed71bd2',1,20,20,'gala','2026-06-06','Other','Completed',NULL,'07/06/2026 00:48:05'),
('08bcac46-1c46-4aeb-bbb2-e55491bd9aba','INV-260607-013','e195e572-0f13-4941-9507-3b72ab7fe853',2,20,40,'gala','2026-06-06','Other','Completed',NULL,'07/06/2026 00:48:05'),
('6a7db6cc-58aa-49de-bccc-05ee953a95c7','INV-260607-013','f817549d-84a8-43d0-9b17-c4f2e2139411',1,20,20,'gala','2026-06-06','Other','Completed',NULL,'07/06/2026 00:48:06'),
('5fa3f65c-c6e9-4038-8d54-f7ce7ea92796','INV-260607-019','03f35113-12f7-42a4-b2fd-460bce8270c1',1,20,20,'gala','2026-06-06','Other','Completed',NULL,'07/06/2026 00:57:37'),
('392039a6-52ec-4aa2-8527-0a9b68511dde','INV-260607-019','2ef01b87-b3eb-4406-bd32-4c9c40317f1b',2,10,20,'gala','2026-06-06','Other','Completed',NULL,'07/06/2026 00:57:37'),
('716b7e4c-b5b4-4a71-b843-9b215ad69e26','INV-260607-019','69c74432-f096-4ff8-be1a-cc042f17ee94',1,20,20,'gala','2026-06-06','Other','Completed',NULL,'07/06/2026 00:57:38'),
('5dbe52a3-36b7-4bab-9d98-c36569ab203b','INV-260607-019','df45ce98-f143-4af4-842d-ce105f435e2b',1,20,20,'gala','2026-06-06','Other','Completed',NULL,'07/06/2026 00:57:38'),
('0bf317a0-51fd-4c70-ac8d-695611e097a1','INV-260607-030','7cdc477f-6160-454d-b32f-9fb6bf6a9abe',2,20,40,'deli','2026-06-06','Other','Completed',NULL,'07/06/2026 02:33:04'),
('a0aa231e-b100-47bd-8b49-49a0efd7a40b','INV-260607-030','9992c921-3216-4b31-b68d-6993c9195a33',1,20,20,'deli','2026-06-06','Other','Completed',NULL,'07/06/2026 02:33:05'),
('46eb794f-e051-4250-aa49-eb3667d5f972','INV-260607-033','135bad36-c75d-442d-ad74-302e4a16764f',1,140,140,'Aiden','2026-06-07','Other','Completed',NULL,'07/06/2026 14:11:38'),
('5f788c4c-a95d-4d83-b789-55553a597bb7','INV-260607-034','124b3c8a-59be-4e2e-8f29-73e691383d6e',2,30,60,'Arkar','2026-06-07','Other','Completed',NULL,'07/06/2026 15:08:18'),
('1824a31f-6a9a-45f5-855e-10e2a050ec43','INV-260607-034','f817549d-84a8-43d0-9b17-c4f2e2139411',1,20,20,'Arkar','2026-06-07','Other','Completed',NULL,'07/06/2026 15:08:19'),
('a76a50f3-a314-4ab3-ab92-e15bae71990c','INV-260607-034','e195e572-0f13-4941-9507-3b72ab7fe853',1,20,20,'Arkar','2026-06-07','Other','Completed',NULL,'07/06/2026 15:08:19'),
('03caa52d-9401-48b8-ad2c-e077e3dddbf8','INV-260607-037','6ed4d5f4-3a0f-4294-bfa1-299e9e4327a9',1,60,60,'swe','2026-06-07','Other','Completed',NULL,'07/06/2026 16:04:34'),
('937be4e7-1691-4c0a-9e5b-6953c744b4a8','INV-260607-046','108d9b43-e053-4163-8e43-01f0bed71bd2',1,20,20,'gala','2026-06-07','Other','Completed',NULL,'07/06/2026 19:05:28'),
('2c342d18-a357-4e05-a447-8ee4eaa95c99','INV-260607-054','03f35113-12f7-42a4-b2fd-460bce8270c1',1,20,20,'jenny','2026-06-07','Other','Completed',NULL,'07/06/2026 22:19:05'),
('6d3ef795-d3e7-43a8-9f97-2b24bb7091e8','INV-260607-054','e195e572-0f13-4941-9507-3b72ab7fe853',1,20,20,'jenny','2026-06-07','Other','Completed',NULL,'07/06/2026 22:19:05'),
('68e7f881-a443-4be0-907f-1f8ce8d536e7','INV-260607-054','f817549d-84a8-43d0-9b17-c4f2e2139411',1,20,20,'jenny','2026-06-07','Other','Completed',NULL,'07/06/2026 22:19:05'),
('ee3fdf04-195e-48f4-8ed7-ba3edf25a9c8','INV-260607-054','809887cd-70f5-45cb-b491-8a708c38b2a2',1,20,20,'jenny','2026-06-07','Other','Completed',NULL,'07/06/2026 22:19:05'),
('cd3a163e-4b14-44ed-aa8f-d5506c875b4c','INV-260607-054','2ef01b87-b3eb-4406-bd32-4c9c40317f1b',1,10,10,'jenny','2026-06-07','Other','Completed',NULL,'07/06/2026 22:19:06'),
('d0deaf81-f0fc-4d5c-b9e2-f0d3c37777c8','INV-260607-054','2ef01b87-b3eb-4406-bd32-4c9c40317f1b',1,10,10,'jenny','2026-06-07','Other','Completed',NULL,'07/06/2026 22:19:06'),
('ddb3e560-8945-4751-a060-5a5cb242161d','INV-260607-064','2ef01b87-b3eb-4406-bd32-4c9c40317f1b',4,10,40,'jenny','2026-06-07','Other','Completed',NULL,'07/06/2026 23:29:46'),
('fb473644-3161-4eac-8858-8093533f0535','INV-260607-070','03f35113-12f7-42a4-b2fd-460bce8270c1',1,20,20,'volley','2026-06-07','Other','Completed',NULL,'07/06/2026 23:36:51'),
('0e78148f-75bc-435d-a998-af07eca9e7e6','INV-260607-070','89a6d5cf-fa6b-4a41-ba96-7338a55eb8ad',1,20,20,'volley','2026-06-07','Other','Completed',NULL,'07/06/2026 23:36:51'),
('37dee6b4-5ecb-4e73-9439-dd5742b13e36','INV-260607-070','1c6123e1-f7ed-4929-bf86-74238b769f41',1,60,60,'volley','2026-06-07','Other','Completed',NULL,'07/06/2026 23:36:52'),
('d8fad809-2f65-4ac3-b899-690a91e08b91','INV-260607-073','108d9b43-e053-4163-8e43-01f0bed71bd2',1,20,20,'volley','2026-06-07','Other','Completed',NULL,'07/06/2026 23:37:46'),
('0ca7b221-0c7a-4eb7-bc9c-d4cfb62c5ca3','INV-260607-073','89a6d5cf-fa6b-4a41-ba96-7338a55eb8ad',1,20,20,'volley','2026-06-07','Other','Completed',NULL,'07/06/2026 23:37:46'),
('1aeca1b5-87f8-4563-8bce-e0c4da9e44d0','INV-260607-073','69c74432-f096-4ff8-be1a-cc042f17ee94',1,20,20,'volley','2026-06-07','Other','Completed',NULL,'07/06/2026 23:37:46'),
('b77ccefa-eb1a-430c-bc78-15d770da9547','INV-260607-073','89a6d5cf-fa6b-4a41-ba96-7338a55eb8ad',1,20,20,'volley','2026-06-07','Other','Completed',NULL,'07/06/2026 23:37:46'),
('baee26dc-eae7-4a54-8746-2722141c8b22','INV-260607-084','0553a0cb-c40c-4ad8-9a9e-5fcbc251672f',1,20,20,'arkash','2026-06-07','Other','Completed',NULL,'07/06/2026 23:46:28'),
('5c87c50b-bc17-4501-99ae-1ff77d6d51a0','INV-260607-084','69c74432-f096-4ff8-be1a-cc042f17ee94',1,20,20,'arkash','2026-06-07','Other','Completed',NULL,'07/06/2026 23:46:28'),
('37457483-6132-4647-8053-5880103e9f6a','INV-260607-084','9992c921-3216-4b31-b68d-6993c9195a33',1,20,20,'arkash','2026-06-07','Other','Completed',NULL,'07/06/2026 23:46:29'),
('bb3c0d3d-29e5-4b9f-8c68-bf8ed8bb5fd8','INV-260607-084','89a6d5cf-fa6b-4a41-ba96-7338a55eb8ad',1,20,20,'arkash','2026-06-07','Other','Completed',NULL,'07/06/2026 23:46:29'),
('c7aedc3e-203c-42ec-a487-b69ebdd6f83f','INV-260608-008','03de14e4-c82c-4a00-8333-fa3122c0cea0',2,10,20,'Naga','2026-06-07','Other','Completed',NULL,'08/06/2026 00:52:18'),
('38143d9f-148c-4429-b542-162711baaa75','INV-260608-008','69c74432-f096-4ff8-be1a-cc042f17ee94',2,20,40,'Naga','2026-06-07','Other','Completed',NULL,'08/06/2026 00:52:18'),
('806d8d55-e7ed-4dc7-80d9-c61e83af5901','INV-260608-008','e75f889b-80a0-42e3-bcfc-270b2586f05f',1,100,100,'Naga','2026-06-07','Other','Completed',NULL,'08/06/2026 00:52:18'),
('0882ad43-4875-48f6-a439-3c0cce532010','INV-260608-008','e195e572-0f13-4941-9507-3b72ab7fe853',1,20,20,'Naga','2026-06-07','Other','Completed',NULL,'08/06/2026 00:52:18'),
('64a81f7d-3cb6-4c02-aaeb-419f7a7e799d','INV-260608-008','03de14e4-c82c-4a00-8333-fa3122c0cea0',3,10,30,'Naga','2026-06-07','Other','Completed',NULL,'08/06/2026 00:52:19'),
('73382cb1-a556-4f9f-a6d4-f8028d04f4b4','INV-260608-008','89a6d5cf-fa6b-4a41-ba96-7338a55eb8ad',2,20,40,'Naga','2026-06-07','Other','Completed',NULL,'08/06/2026 00:52:19'),
('0ad0e230-d632-4c23-9da6-75186aefa8e1','INV-260608-018','9992c921-3216-4b31-b68d-6993c9195a33',1,20,20,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:16:34'),
('1f3ad232-b5e3-4f8f-bd12-dbd51f6080bc','INV-260608-018','c7e15cf2-8e41-4f17-b901-cc7f6bfab244',2,60,120,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:16:34'),
('487e005f-9f18-468d-b4b1-66ee8c89f9e2','INV-260608-018','03de14e4-c82c-4a00-8333-fa3122c0cea0',5,10,50,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:16:35'),
('72cd24c8-fcbe-412d-ba44-6334d00c11d0','INV-260608-021','29edc5b5-b23a-4b67-8c81-e047aea00a91',1,60,60,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:18:20'),
('e68df52a-728f-4016-a38f-949f19374970','INV-260608-021','0553a0cb-c40c-4ad8-9a9e-5fcbc251672f',2,20,40,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:18:21'),
('02fa33ae-cf0d-4f17-8580-5cb1fcf2f1a2','INV-260608-021','9992c921-3216-4b31-b68d-6993c9195a33',1,20,20,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:18:21'),
('2b6e346a-4beb-413a-b847-ffb92709c895','INV-260608-021','03de14e4-c82c-4a00-8333-fa3122c0cea0',5,10,50,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:18:21'),
('035bae48-8c70-421e-af79-94231908fbf7','INV-260608-025','c7e15cf2-8e41-4f17-b901-cc7f6bfab244',2,60,120,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:19:09'),
('fe3902a6-509e-4260-84e1-7c8534834c21','INV-260608-025','03de14e4-c82c-4a00-8333-fa3122c0cea0',5,10,50,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:19:09'),
('bca57d6a-586c-4ebe-8a00-14cf7b5d28c6','INV-260608-025','9992c921-3216-4b31-b68d-6993c9195a33',1,20,20,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:19:09'),
('c12d6dff-54d1-432a-a155-4eaf4e153b3d','INV-260608-025','0553a0cb-c40c-4ad8-9a9e-5fcbc251672f',2,20,40,'naga','2026-06-07','Other','Completed',NULL,'08/06/2026 01:19:09'),
('01441423-7eac-4d03-a6de-21d72bb7ef10','INV-260608-048','6ed4d5f4-3a0f-4294-bfa1-299e9e4327a9',1,60,60,'James','2026-06-08','Other','Completed',NULL,'08/06/2026 16:41:02'),
('75fc269c-0755-4de4-8bbd-9105f755353a','INV-260608-049','809887cd-70f5-45cb-b491-8a708c38b2a2',1,20,20,'Arkar ','2026-06-08','Other','Completed',NULL,'08/06/2026 17:20:48');

-- Recurring customers (one row per unique name)
INSERT INTO public.customers (name, phone)
SELECT DISTINCT trim(s.customer_name), ''
FROM public.staging_old_sales s
WHERE trim(COALESCE(s.customer_name,'')) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE lower(c.name)=lower(trim(s.customer_name)));

-- Orders (one per InvoiceNumber)
INSERT INTO public.orders (
  order_number, invoice_number, customer_name, order_type, status,
  subtotal, delivery_fee, total_amount, payment_method, payment_status,
  notes, is_manual, created_at, updated_at)
SELECT s.invoice_number, s.invoice_number,
  COALESCE(NULLIF(trim(MAX(s.customer_name)),''),'Walk-in'),
  'pickup','delivered', SUM(s.total_price), 0, SUM(s.total_price),
  COALESCE(NULLIF(trim(MAX(s.payment_method)),''),'Other'), 'paid',
  NULLIF(trim(MAX(s.notes)),''), true,
  MIN(to_timestamp(s.created_at,'DD/MM/YYYY HH24:MI:SS')),
  MIN(to_timestamp(s.created_at,'DD/MM/YYYY HH24:MI:SS'))
FROM public.staging_old_sales s
WHERE s.invoice_number IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.invoice_number=s.invoice_number)
GROUP BY s.invoice_number;

-- Order items (name + cost looked up from products; tolerant of missing)
INSERT INTO public.order_items (
  order_id, product_id, product_name, quantity, unit_price, total_price, cost_price)
SELECT o.id, p.id, COALESCE(p.name,'Imported item'),
  s.quantity, s.unit_price, s.total_price, COALESCE(p.cost_price,0)
FROM public.staging_old_sales s
JOIN public.orders o ON o.invoice_number=s.invoice_number
LEFT JOIN public.products p ON p.id=(CASE WHEN s.item_id ~* '^[0-9a-f-]{36}$' THEN s.item_id::uuid END)
WHERE o.is_manual=true
  AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id);
