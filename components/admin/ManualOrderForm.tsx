"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, Search } from "lucide-react";
import toast from "react-hot-toast";
import { createManualOrderAction } from "@/app/admin/orders/actions";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Customer, OrderType, PaymentMethod, Product, SettingsMap } from "@/lib/types";

const inputTheme =
  "border-black/15 bg-white text-black placeholder:text-black/40 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/15 dark:bg-black dark:text-white dark:placeholder:text-white/40";

interface Line {
  product: Product;
  quantity: number;
  /** Editable unit price for this walk-in (defaults to the product price). */
  unitPrice: number;
}

export function ManualOrderForm({
  products,
  customers,
  settings,
}: {
  products: Product[];
  customers: Customer[];
  settings: SettingsMap;
}) {
  const router = useRouter();
  const currency = settings.currency_symbol ?? "₹";
  const deliveryFee = Number(settings.delivery_fee ?? 10);

  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [customer, setCustomer] = useState({ name: "", phone: "", room: "" });
  // Whether the name field is focused — controls the suggestions dropdown.
  const [nameFocused, setNameFocused] = useState(false);

  // Live name suggestions from the saved customer directory.
  const customerMatches = useMemo(() => {
    const q = customer.name.trim().toLowerCase();
    if (!q) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [customers, customer.name]);

  // Exact (case-insensitive) hit on a saved customer — this order will merge.
  const matchedCustomer = useMemo(() => {
    const q = customer.name.trim().toLowerCase();
    return q ? customers.find((c) => c.name.toLowerCase() === q) : undefined;
  }, [customers, customer.name]);

  function pickCustomer(c: Customer) {
    setCustomer({ name: c.name, phone: c.phone ?? "", room: c.room_number ?? "" });
    setNameFocused(false);
  }
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  // Goods handed over but payment not collected yet (e.g. UPI/server down) —
  // the order completes but stays "Unpaid" until marked paid on the orders page.
  const [paymentPending, setPaymentPending] = useState(false);
  // Split payment: how much of the total was paid in cash (UPI = total − cash).
  const [cashAmount, setCashAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const results = useMemo(
    () =>
      query.trim()
        ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
        : [],
    [products, query]
  );

  function add(p: Product) {
    setLines((ls) => {
      const existing = ls.find((l) => l.product.id === p.id);
      if (existing)
        return ls.map((l) =>
          l.product.id === p.id ? { ...l, quantity: Math.min(l.quantity + 1, p.current_stock) } : l
        );
      return [...ls, { product: p, quantity: 1, unitPrice: Number(p.selling_price) }];
    });
    setQuery("");
  }

  function setQty(id: string, delta: number) {
    setLines((ls) =>
      ls
        .map((l) =>
          l.product.id === id
            ? { ...l, quantity: Math.max(0, Math.min(l.quantity + delta, l.product.current_stock)) }
            : l
        )
        .filter((l) => l.quantity > 0)
    );
  }

  function setPrice(id: string, value: string) {
    const v = Math.max(0, Number(value) || 0);
    setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, unitPrice: v } : l)));
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const fee = orderType === "delivery" ? deliveryFee : 0;
  const total = subtotal + fee;

  // Split payment: cash is clamped to [0, total]; UPI is the remainder.
  const cashPaid = Math.min(Math.max(Number(cashAmount) || 0, 0), total);
  const upiPaid = Math.max(total - cashPaid, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) return toast.error("Add at least one product.");
    if (!customer.name.trim()) return toast.error("Customer name is required.");
    if (orderType === "delivery" && !customer.room.trim())
      return toast.error("Room is required for delivery.");

    setSaving(true);
    const res = await createManualOrderAction({
      items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity, unit_price: l.unitPrice })),
      order_type: orderType,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_room: customer.room,
      payment_method: payment,
      ...(payment === "split" ? { paid_cash: cashPaid, paid_upi: upiPaid } : {}),
      payment_pending: paymentPending,
      notes,
    });
    setSaving(false);
    if (!res.ok || !res.order) return toast.error(res.error ?? "Failed to create order.");
    setLines([]);
    setQuery("");
    setCustomer({ name: "", phone: "", room: "" });
    setPayment("cash");
    setPaymentPending(false);
    setCashAmount("");
    setNotes("");
    setOrderType("pickup");
    toast.success(
      `Order ${res.order.order_number} completed${paymentPending ? " · payment pending" : ""}`
    );
    // Stay on the manual-order page (fields already reset above) so the admin
    // can ring up the next walk-in immediately. refresh() re-pulls live stock.
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <AdminCard title="Add Products">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products to add…"
              className={`h-10 w-full rounded-lg border pl-9 pr-3 text-sm ${inputTheme}`}
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/15 bg-white text-black shadow-xl dark:border-white/15 dark:bg-stone-900 dark:text-white">
                {results.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => add(p)}
                    disabled={p.current_stock <= 0}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-stone-700 hover:bg-black/5 dark:text-stone-200 dark:hover:bg-white/10 disabled:opacity-40"
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-gray-500">
                      {formatCurrency(p.selling_price, currency)} · stock {p.current_stock}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {lines.length === 0 && <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">No items added.</p>}
            {lines.map((l) => (
              <div key={l.product.id} className="flex items-center gap-3 rounded-lg bg-stone-50 p-2.5 dark:bg-stone-900">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-950 dark:text-white">{l.product.name}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>{currency}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => setPrice(l.product.id, e.target.value)}
                      className={`h-7 w-16 rounded-md px-1.5 text-xs ${inputTheme}`}
                      aria-label="Unit price"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setQty(l.product.id, -1)} className="grid h-7 w-7 place-items-center rounded-md bg-black/5 text-stone-950 dark:bg-white/10 dark:text-white">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-stone-950 dark:text-white">{l.quantity}</span>
                  <button type="button" onClick={() => setQty(l.product.id, 1)} className="grid h-7 w-7 place-items-center rounded-md bg-black/5 text-stone-950 dark:bg-white/10 dark:text-white">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="w-16 text-right text-sm text-stone-950 dark:text-white">
                  {formatCurrency(l.unitPrice * l.quantity, currency)}
                </span>
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((x) => x.product.id !== l.product.id))}
                  className="text-stone-500 hover:text-red-400 dark:text-stone-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard title="Customer">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative">
              <Label className="text-stone-700 dark:text-stone-300">Name</Label>
              <Input
                required
                value={customer.name}
                onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                onFocus={() => setNameFocused(true)}
                // Delay so a click on a suggestion registers before it closes.
                onBlur={() => setTimeout(() => setNameFocused(false), 150)}
                placeholder="Type a name…"
                autoComplete="off"
                className={inputTheme}
              />
              {nameFocused && customerMatches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/15 bg-white text-black shadow-xl dark:border-white/15 dark:bg-stone-900 dark:text-white">
                  {customerMatches.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickCustomer(c)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-stone-700 hover:bg-black/5 dark:text-stone-200 dark:hover:bg-white/10"
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-gray-500">{c.phone || "no phone"}</span>
                    </button>
                  ))}
                </div>
              )}
              {matchedCustomer && (
                <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  Merges with saved customer{matchedCustomer.phone ? ` · ${matchedCustomer.phone}` : ""}
                </p>
              )}
            </div>
            <div>
              <Label className="text-stone-700 dark:text-stone-300">Phone (optional)</Label>
              <Input value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} className={inputTheme} />
            </div>

            {orderType === "delivery" && (
              <div>
                <Label className="text-stone-700 dark:text-stone-300">Room number</Label>
                <Input required value={customer.room} onChange={(e) => setCustomer((c) => ({ ...c, room: e.target.value }))} className={inputTheme} />
              </div>
            )}
            <div className={orderType === "delivery" ? "" : "sm:col-span-2"}>
              <Label className="text-stone-700 dark:text-stone-300">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputTheme} rows={1} />
            </div>
          </div>
        </AdminCard>
      </div>

      <div className="space-y-4">
        <AdminCard title="Order Settings">
          <div className="space-y-4">
            <div>
              <Label className="text-stone-700 dark:text-stone-300">Order type</Label>
              <Select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)} className={inputTheme}>
                <option value="pickup">Pickup (Free)</option>
                <option value="delivery">Delivery (+{formatCurrency(deliveryFee, currency)})</option>
              </Select>
            </div>
            <div>
              <Label className="text-stone-700 dark:text-stone-300">Payment method</Label>
              <Select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)} className={inputTheme}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="split">Split (Cash + UPI)</option>
              </Select>
            </div>
            {payment === "split" && (
              <div>
                <Label className="text-stone-700 dark:text-stone-300">Paid by cash ({currency})</Label>
                <Input
                  type="number"
                  min="0"
                  max={total}
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0"
                  className={inputTheme}
                />
                <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                  Cash {formatCurrency(cashPaid, currency)} · UPI {formatCurrency(upiPaid, currency)} of {formatCurrency(total, currency)}
                </p>
              </div>
            )}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-400/20 dark:bg-amber-400/10">
              <input
                type="checkbox"
                checked={paymentPending}
                onChange={(e) => setPaymentPending(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <span className="text-sm text-stone-700 dark:text-stone-200">
                Payment pending
                <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">
                  Hand over the goods now but collect later (e.g. UPI/server down). Mark it paid from the Orders page.
                </span>
              </span>
            </label>
          </div>
        </AdminCard>

        <AdminCard title="Summary">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>Subtotal</span>
              <span className="text-stone-950 dark:text-white">{formatCurrency(subtotal, currency)}</span>
            </div>
            {orderType === "delivery" && (
              <div className="flex justify-between text-stone-600 dark:text-stone-400">
                <span>Delivery fee</span>
                <span className="text-stone-950 dark:text-white">{formatCurrency(fee, currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-black/10 pt-2 text-base font-bold text-stone-950 dark:border-white/10 dark:text-white">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </AdminCard>

        <Button type="submit" loading={saving} variant="dark" className="w-full">
          Complete Order
        </Button>
      </div>
    </form>
  );
}
