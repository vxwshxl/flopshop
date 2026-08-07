import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader, AdminCard } from "@/components/admin/StatCard";
import { OrderManagePanel } from "@/components/admin/OrderManagePanel";
import { OrderCustomerEdit } from "@/components/admin/OrderCustomerEdit";
import { OrderItemsEdit } from "@/components/admin/OrderItemsEdit";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { DeleteOrderButton } from "@/components/admin/DeleteOrderButton";
import { PrintButton } from "@/components/PrintButton";
import { PrintPortal } from "@/components/PrintPortal";
import { Invoice } from "@/components/Invoice";
import { adminOrderBackLink } from "@/lib/utils/backLink";
import { formatCurrency, formatDateTime, formatPaymentMethod } from "@/lib/utils/formatters";
import type { Order, Product, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const back = adminOrderBackLink((await searchParams).from);
  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const [{ data }, { data: people }, { data: productList }] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").eq("id", id).single(),
    supabase.from("profiles").select("id, full_name").in("role", ["delivery", "admin"]),
    supabase.from("products").select("id, name, selling_price").eq("is_active", true).order("name"),
  ]);

  if (!data) notFound();
  const order = data as Order;

  // Wallet the payment panel can charge credit to. Signed-up users own theirs
  // directly; a walk-in's is found by the name on the order, the same way the
  // server actions resolve it.
  const walletQuery = supabase.from("wallets").select("balance");
  const { data: walletRow } = order.user_id
    ? await walletQuery.eq("profile_id", order.user_id).maybeSingle()
    : await (async () => {
        const name = order.customer_name?.trim();
        if (!name) return { data: null };
        const { data: c } = await supabase.from("customers").select("id").ilike("name", name).limit(1);
        const customerId = c?.[0]?.id;
        if (!customerId) return { data: null };
        return supabase.from("wallets").select("balance").eq("customer_id", customerId).maybeSingle();
      })();
  // A wallet row may not exist yet — it's created on first charge, so having a
  // customer at all is what decides whether credit is offered.
  const hasWalletOwner = !!order.user_id || !!order.customer_name?.trim();
  const walletBalance = walletRow ? Number(walletRow.balance) : 0;

  return (
    <div>
      <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> {back.label}
      </Link>
      <PageHeader
        title={order.order_number}
        subtitle={formatDateTime(order.created_at)}
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <OrderStatusBadge status={order.status} />
            <DeleteOrderButton orderId={order.id} orderNumber={order.order_number} />
            <PrintButton label="Print invoice" />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AdminCard title="Customer" action={<OrderCustomerEdit order={order} />}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Name" value={order.customer_name} />
              <Field label="Phone" value={order.customer_phone ?? "—"} />
              <Field label="Room" value={order.customer_room ?? "—"} />
              <Field label="Type" value={order.order_type} />
              <Field
                label="Payment"
                value={
                  order.payment_status === "partial"
                    ? `${formatPaymentMethod(order, currency)} · paid ${formatCurrency(order.amount_paid, currency)} / ${formatCurrency(order.total_amount, currency)} (${formatCurrency(Math.max(order.total_amount - order.amount_paid, 0), currency)} due)`
                    : `${formatPaymentMethod(order, currency)} · ${order.payment_status}`
                }
              />
              <Field label="Source" value={order.is_manual ? "Walk-in (manual)" : "Online"} />
              {order.status === "cancelled" && order.cancel_reason && (
                <Field label="Cancelled because" value={order.cancel_reason} />
              )}
            </div>
            {order.notes && (
              <p className="mt-3 rounded-lg bg-[#0a0a0a] p-3 text-sm text-gray-400">📝 {order.notes}</p>
            )}
          </AdminCard>

          <AdminCard
            title="Items"
            action={
              <OrderItemsEdit
                order={order}
                products={(productList as Pick<Product, "id" | "name" | "selling_price">[]) ?? []}
              />
            }
          >
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[26rem] text-sm text-gray-300">
                <thead>
                  <tr className="whitespace-nowrap text-left text-xs text-gray-500">
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-center">Qty</th>
                    <th className="pb-2 text-right">Unit</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.order_items?.map((it) => (
                    <tr key={it.id} className="border-t border-[#222]">
                      <td className="py-2 pr-3">{it.product_name}</td>
                      <td className="num py-2 text-center">{it.quantity}</td>
                      <td className="num py-2 pl-3 text-right">{formatCurrency(it.unit_price, currency)}</td>
                      <td className="num py-2 pl-3 text-right">{formatCurrency(it.total_price, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-1 border-t border-[#222] pt-3 text-sm">
              <Line label="Subtotal" value={formatCurrency(order.subtotal, currency)} />
              {order.order_type === "delivery" && (
                <>
                  <Line label="Delivery fee" value={formatCurrency(order.delivery_fee, currency)} />
                  <p className="break-words text-right text-xs text-gray-500">
                    Delivery person {formatCurrency(order.delivery_person_earning, currency)} · Shop{" "}
                    {formatCurrency(order.admin_delivery_earning, currency)}
                  </p>
                </>
              )}
              <div className="num-row pt-1 text-base font-bold text-white">
                <span>Total</span>
                <span>{formatCurrency(order.total_amount, currency)}</span>
              </div>
            </div>
          </AdminCard>

          <AdminCard title="Invoice">
            <div className="rounded-lg bg-white p-4">
              <Invoice order={order} settings={settings} />
            </div>
          </AdminCard>
        </div>

        <div>
          <OrderManagePanel
            order={order}
            deliveryPeople={(people as Pick<Profile, "id" | "full_name">[]) ?? []}
            hasWalletOwner={hasWalletOwner}
            walletBalance={walletBalance}
          />
        </div>
      </div>

      <PrintPortal>
        <Invoice order={order} settings={settings} />
      </PrintPortal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="break-words font-medium capitalize text-white">{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="num-row text-gray-400">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
