import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { PageHeader, AdminCard, StatCard } from "@/components/admin/StatCard";
import { UserOrdersTable } from "@/components/admin/UserOrdersTable";
import { WalletPanel } from "@/components/admin/WalletPanel";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { getWalletWithTransactions } from "@/lib/server/wallet";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/formatters";
import type { Customer, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Escape LIKE wildcards so a name containing % or _ still matches exactly. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export default async function AdminCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const { data: customerData } = await supabase.from("customers").select("*").eq("id", id).single();
  if (!customerData) notFound();
  const customer = customerData as Customer;

  // Orders carry a name snapshot rather than a customer FK, so history is matched
  // by name (case-insensitive, the same rule `upsertCustomerByName` and merging use).
  const { data: orderData } = await supabase
    .from("orders")
    .select("*")
    .ilike("customer_name", escapeLike(customer.name))
    .order("created_at", { ascending: false });
  const orders = (orderData as Order[]) ?? [];

  const { wallet, transactions } = await getWalletWithTransactions({ customerId: id });
  const balance = wallet ? Number(wallet.balance) : 0;

  const completed = orders.filter((o) => o.status !== "cancelled");
  const totalSpent = completed.reduce((s, o) => s + o.total_amount, 0);
  const outstanding = completed.reduce((s, o) => s + Math.max(o.total_amount - o.amount_paid, 0), 0);
  const lastOrder = orders[0];

  return (
    <div>
      <RealtimeRefresh table="orders" channel={`admin:customer-orders:${id}`} />
      <Link
        href="/admin/customers"
        className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>
      <PageHeader
        title={customer.name}
        subtitle={`Added ${formatDate(customer.created_at)}`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Orders" value={orders.length} hint={`${completed.length} completed`} />
        <StatCard label="Total spent" value={formatCurrency(totalSpent, currency)} hint="Excludes cancelled" />
        <StatCard
          label={balance < 0 ? "Wallet debt" : "Wallet credit"}
          value={formatCurrency(balance, currency)}
        />
        <StatCard
          label="Unpaid balance"
          value={formatCurrency(outstanding, currency)}
          hint="Across all orders"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title="Details" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
            <Field label="Phone" value={customer.phone || "—"} />
            <Field label="Email" value={customer.email ?? "—"} plain />
            <Field label="Room" value={customer.room_number ?? "—"} />
            <Field label="Hostel block" value={customer.hostel_block ?? "—"} />
            <Field
              label="Last order"
              value={lastOrder ? formatDateTime(lastOrder.created_at) : "—"}
            />
          </div>
        </AdminCard>

        <AdminCard title="Order history" className="lg:col-span-2">
          <UserOrdersTable
            orders={orders}
            currency={currency}
            emptyText="This customer has no orders yet."
          />
        </AdminCard>
      </div>

      <div className="mt-4">
        <AdminCard title="Store Credit / Wallet">
          <WalletPanel
            owner={{ customerId: id }}
            initialBalance={balance}
            transactions={transactions}
            currency={currency}
          />
        </AdminCard>
      </div>
    </div>
  );
}

function Field({ label, value, plain = false }: { label: string; value: string; plain?: boolean }) {
  return (
    <div>
      <p className="text-xs text-black/50 dark:text-white/50">{label}</p>
      <p className={`mt-0.5 font-medium text-black dark:text-white ${plain ? "break-all" : "capitalize"}`}>{value}</p>
    </div>
  );
}
