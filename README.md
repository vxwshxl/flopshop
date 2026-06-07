# 🛒 FlopShop — Hostel Shop Management System

A full-stack hostel snack shop: students browse and order (pickup or room delivery),
admins manage the catalog, orders, inventory, invoices and reports, and delivery
persons fulfil assigned orders.

Built with **Next.js 16 (App Router) · TypeScript · Supabase (Auth + Postgres + Storage) ·
Tailwind CSS · Recharts · Zustand**.

---

## 1. Setup

### Install dependencies
```bash
npm install
```

### Configure environment
Fill in `.env.local` (already scaffolded) with values from your Supabase project
(**Settings → API**):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-only, never exposed to the browser
```

### Create the database
Open the **Supabase SQL editor** and run the entire script in
[`supabase/schema.sql`](supabase/schema.sql). It creates all tables, the
auto-profile trigger, the `adjust_stock` function, RLS policies, seed categories
& settings, and the `product-images` storage bucket.

### Run
```bash
npm run dev      # http://localhost:3000
npm run build    # production build
```

---

## 2. Create your first admin

Roles are stored in the DB and default to `user`. After signing up through the app,
promote yourself in the Supabase SQL editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';
```

Then visit `/admin`. You can manage everyone else's roles from **Admin → Users**.
Set a user to `delivery` to give them the `/delivery` panel.

---

## 3. How it works

| Area | Route | Notes |
|------|-------|-------|
| Storefront | `/` | Browse by category, quick add to cart, sticky cart bar |
| Cart / Checkout | `/cart`, `/checkout` | Pickup = guest allowed · Delivery = login required |
| My orders | `/orders` | Order history + printable invoice + status timeline |
| Admin | `/admin` | Dark dashboard: stats, 7-day revenue, category pie |
| Products / Categories | `/admin/products`, `/admin/categories` | CRUD + image upload to Storage |
| Purchases | `/admin/purchases` | Records restock **and** bumps product stock |
| Orders / Manual order | `/admin/orders`, `/admin/orders/new` | Status flow, assign delivery, walk-in orders |
| Invoices | `/admin/invoices` | Searchable list + printable invoice view |
| Reports | `/admin/reports` | Sales · Profit · Inventory tabs + CSV export |
| Settings | `/admin/settings` | Dynamic shop name, fees, delivery split, open/closed |
| Delivery | `/delivery` | Assigned orders, mark delivered, earnings |

### Business rules
- **Delivery fee split** is fully dynamic from `settings`: ₹10 total = ₹8 delivery person + ₹2 shop. The three values are stored on every order.
- **Stock** is deducted when an order moves out of `pending` (confirmed/preparing/…) and restored if it is later cancelled. Manual orders are auto-confirmed and deduct immediately.
- **Order #** `ORD-YYMMDD-####` · **Invoice #** `INV-YYMMDD-###`.
- **Route protection** lives in [`proxy.ts`](proxy.ts) (`/admin` → admin, `/delivery` → delivery/admin, `/orders` → any auth).

---

## 4. Architecture notes
- Order creation (checkout + manual) runs **server-side** with the service-role client
  ([`lib/server/orders.ts`](lib/server/orders.ts)) so prices and stock are validated
  against the DB and guest pickup orders work despite RLS.
- Admin catalog/settings/user mutations run client-side via the browser client and are
  authorised by RLS admin policies.
- Cart is a persisted **Zustand** store ([`lib/hooks/useCart.ts`](lib/hooks/useCart.ts)).

## 5. Deploy (Vercel)
Push to a Git repo, import into Vercel, add the three env vars, and deploy. Add your
Vercel URL to Supabase **Authentication → URL Configuration** redirect allow-list.
