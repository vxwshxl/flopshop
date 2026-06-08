import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader, AdminCard } from "@/components/admin/StatCard";
import { OrderManagePanel } from "@/components/admin/OrderManagePanel";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { PrintButton } from "@/components/PrintButton";
import { PrintPortal } from "@/components/PrintPortal";
import { Invoice } from "@/components/Invoice";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { Order, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const [{ data }, { data: people }] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").eq("id", id).single(),
    supabase.from("profiles").select("id, full_name").in("role", ["delivery", "admin"]),
  ]);

  if (!data) notFound();
  const order = data as Order;

  return (
    <div>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>
      <PageHeader
        title={order.order_number}
        subtitle={formatDateTime(order.created_at)}
        action={
          <div className="flex items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <PrintButton label="Print invoice" />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AdminCard title="Customer">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Name" value={order.customer_name} />
              <Field label="Phone" value={order.customer_phone ?? "—"} />
              <Field label="Room" value={order.customer_room ?? "—"} />
              <Field label="Type" value={order.order_type} />
              <Field label="Payment" value={`${order.payment_method} · ${order.payment_status}`} />
              <Field label="Source" value={order.is_manual ? "Walk-in (manual)" : "Online"} />
              {order.status === "cancelled" && order.cancel_reason && (
                <Field label="Cancelled because" value={order.cancel_reason} />
              )}
            </div>
            {order.notes && (
              <p className="mt-3 rounded-lg bg-[#0a0a0a] p-3 text-sm text-gray-400">📝 {order.notes}</p>
            )}
          </AdminCard>

          <AdminCard title="Items">
            <table className="w-full text-sm text-gray-300">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Unit</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items?.map((it) => (
                  <tr key={it.id} className="border-t border-[#222]">
                    <td className="py-2">{it.product_name}</td>
                    <td className="py-2 text-center">{it.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(it.unit_price, currency)}</td>
                    <td className="py-2 text-right">{formatCurrency(it.total_price, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 border-t border-[#222] pt-3 text-sm">
              <Line label="Subtotal" value={formatCurrency(order.subtotal, currency)} />
              {order.order_type === "delivery" && (
                <>
                  <Line label="Delivery fee" value={formatCurrency(order.delivery_fee, currency)} />
                  <p className="text-right text-xs text-gray-500">
                    Delivery person {formatCurrency(order.delivery_person_earning, currency)} · Shop{" "}
                    {formatCurrency(order.admin_delivery_earning, currency)}
                  </p>
                </>
              )}
              <div className="flex justify-between pt-1 text-base font-bold text-white">
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
          <OrderManagePanel order={order} deliveryPeople={(people as Pick<Profile, "id" | "full_name">[]) ?? []} />
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
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium capitalize text-white">{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-400">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
