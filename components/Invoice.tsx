import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { Order, SettingsMap } from "@/lib/types";

/** Printable invoice. Wrap with className="print-area" to isolate for printing. */
export function Invoice({ order, settings, showOtp = false }: { order: Order; settings: SettingsMap; showOtp?: boolean }) {
  const currency = settings.currency_symbol ?? "₹";
  return (
    <div className="print-area mx-auto max-w-md bg-white text-gray-900">
      <div className="border-b border-gray-200 pb-4 text-center">
        <h2 className="text-2xl font-extrabold">{settings.shop_name ?? "FlopShop"}</h2>
        <p className="text-xs text-gray-500">{settings.shop_tagline}</p>
        {settings.shop_phone && <p className="text-xs text-gray-500">☎ {settings.shop_phone}</p>}
        {settings.shop_address && <p className="text-xs text-gray-500">{settings.shop_address}</p>}
      </div>

      <div className="flex justify-between border-b border-gray-100 py-3 text-sm">
        <div>
          <p className="font-semibold">Invoice</p>
          <p className="text-gray-600">{order.invoice_number ?? order.order_number}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-600">{formatDateTime(order.created_at)}</p>
          <p className="text-gray-600 capitalize">{order.order_type} order</p>
        </div>
      </div>

      <div className="border-b border-gray-100 py-3 text-sm">
        <p className="font-semibold">Billed to</p>
        <p className="text-gray-700">{order.customer_name}</p>
        {order.customer_phone && <p className="text-gray-600">{order.customer_phone}</p>}
        {order.customer_room && <p className="text-gray-600">Room {order.customer_room}</p>}
      </div>

      <table className="w-full border-b border-gray-100 py-2 text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400">
            <th className="py-2">Item</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.order_items?.map((it) => (
            <tr key={it.id} className="border-t border-gray-50">
              <td className="py-1.5">{it.product_name}</td>
              <td className="py-1.5 text-center">{it.quantity}</td>
              <td className="py-1.5 text-right">{formatCurrency(it.unit_price, currency)}</td>
              <td className="py-1.5 text-right">{formatCurrency(it.total_price, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="py-3 text-sm">
        <Row label="Subtotal" value={formatCurrency(order.subtotal, currency)} />
        {order.order_type === "delivery" && (
          <>
            <Row label="Delivery Fee" value={formatCurrency(order.delivery_fee, currency)} />
            <p className="text-right text-xs text-gray-400">
              Delivery Person: {formatCurrency(order.delivery_person_earning, currency)} | Shop:{" "}
              {formatCurrency(order.admin_delivery_earning, currency)}
            </p>
          </>
        )}
        {showOtp && order.otp_code && (
          <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
            <p className="font-semibold">Order OTP</p>
            <p className="mt-2 text-xl tracking-[0.35em] font-semibold">{order.otp_code}</p>
            <p className="mt-1 text-xs text-yellow-700">
              Share this 4-digit code with your delivery partner or pickup admin when they arrive.
            </p>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
          <span>Total</span>
          <span>{formatCurrency(order.total_amount, currency)}</span>
        </div>
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>Payment</span>
          <span className="capitalize">
            {order.payment_method} · {order.payment_status}
          </span>
        </div>
      </div>

      <p className="border-t border-gray-100 pt-3 text-center text-xs text-gray-400">
        Thank you for shopping with {settings.shop_name ?? "FlopShop"}! 🛒
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
