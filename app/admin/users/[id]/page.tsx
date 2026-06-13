import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader, AdminCard, StatCard } from "@/components/admin/StatCard";
import { UserOrdersTable } from "@/components/admin/UserOrdersTable";
import { WalletPanel } from "@/components/admin/WalletPanel";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { getWalletWithTransactions } from "@/lib/server/wallet";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/formatters";
import type { Order, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const [{ data: profile }, { data: orderData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase.from("orders").select("*").eq("user_id", id).order("created_at", { ascending: false }),
  ]);

  if (!profile) notFound();
  const user = profile as Profile;
  const orders = (orderData as Order[]) ?? [];

  const { wallet, transactions } = await getWalletWithTransactions({ profileId: id });

  const completed = orders.filter((o) => o.status !== "cancelled");
  const totalSpent = completed.reduce((s, o) => s + o.total_amount, 0);

  return (
    <div>
      <RealtimeRefresh table="orders" channel={`admin:user-orders:${id}`} />
      <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>
      <PageHeader
        title={user.full_name ?? "User"}
        subtitle={`Joined ${formatDate(user.created_at)}`}
        action={
          <span
            className={`rounded-full px-3 py-1 text-xs ${
              user.is_active
                ? "border border-yellow-400 bg-yellow-400 text-black"
                : "border border-black/15 text-black/50 dark:border-white/15 dark:text-white/50"
            }`}
          >
            {user.is_active ? "Active" : "Inactive"}
          </span>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Orders" value={orders.length} />
        <StatCard label="Total spent" value={formatCurrency(totalSpent, currency)} hint="Excludes cancelled" />
        <StatCard label="Wallet credit" value={formatCurrency(wallet ? Number(wallet.balance) : 0, currency)} />
        <StatCard label="Role" value={user.role} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title="Details" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
            <Field label="Email" value={user.email ?? "—"} plain />
            <Field label="Phone" value={user.phone ?? "—"} />
            <Field label="Room" value={user.room_number ?? "—"} />
            <Field label="Hostel block" value={user.hostel_block ?? "—"} />
            <Field
              label="Last active"
              value={user.last_active_at ? formatDateTime(user.last_active_at) : "—"}
            />
          </div>
        </AdminCard>

        <AdminCard title="Orders" className="lg:col-span-2">
          <UserOrdersTable orders={orders} currency={currency} />
        </AdminCard>
      </div>

      <div className="mt-4">
        <AdminCard title="Store Credit / Wallet">
          <WalletPanel
            owner={{ profileId: id }}
            initialBalance={wallet ? Number(wallet.balance) : 0}
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
