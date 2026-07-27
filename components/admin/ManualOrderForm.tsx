"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, Search, Wallet as WalletIcon } from "lucide-react";
import toast from "react-hot-toast";
import { createManualOrderAction } from "@/app/admin/orders/actions";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Autocomplete } from "@/components/ui/autocomplete";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Customer, OrderType, PaymentMethod, Product, Profile, SettingsMap } from "@/lib/types";

const inputTheme =
  "border-black/15 bg-white text-black placeholder:text-black/40 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/15 dark:bg-black dark:text-white dark:placeholder:text-white/40";

interface Line {
  product: Product;
  quantity: number;
  /** Editable unit price for this walk-in (defaults to the product price). */
  unitPrice: number;
}

/** The slice of a signed-up app user this form needs to bill them. */
export type ManualOrderUser = Pick<
  Profile,
  "id" | "full_name" | "email" | "phone" | "room_number" | "hostel_block"
>;

/**
 * Someone this order can be billed to. Walk-ins live in the `customers`
 * directory; app users are `profiles`. Both own a wallet, so both can pay by
 * credit — `kind` decides which wallet the charge lands on.
 */
type Account = {
  id: string;
  kind: "user" | "customer";
  name: string;
  phone: string;
  room: string;
  email: string | null;
};

function formatRoom(block: string | null, room: string | null): string {
  if (block && room) return `${block}, Rm ${room}`;
  return room ?? "";
}

export function ManualOrderForm({
  products,
  customers,
  users = [],
  balances = {},
  settings,
}: {
  products: Product[];
  customers: Customer[];
  /** Signed-up app users, billable to their profile wallet. */
  users?: ManualOrderUser[];
  /** Wallet balance per account id (customer OR profile) — drives "Pay by credit". */
  balances?: Record<string, number>;
  settings: SettingsMap;
}) {
  const router = useRouter();
  const currency = settings.currency_symbol ?? "₹";
  const deliveryFee = Number(settings.delivery_fee ?? 10);

  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [customer, setCustomer] = useState({ name: "", phone: "", room: "" });
  // Keyboard-highlighted row in the product search dropdown (↑/↓ move, Enter picks).
  const [productActive, setProductActive] = useState(0);

  // App users first — a walk-in who already has an account should be the obvious
  // pick, so their wallet is charged instead of a same-named walk-in record.
  const accounts = useMemo<Account[]>(
    () => [
      ...users.map((u) => ({
        id: u.id,
        kind: "user" as const,
        name: (u.full_name ?? u.email ?? "User").trim(),
        phone: u.phone ?? "",
        room: formatRoom(u.hostel_block, u.room_number),
        email: u.email,
      })),
      ...customers.map((c) => ({
        id: c.id,
        kind: "customer" as const,
        name: c.name,
        phone: c.phone ?? "",
        room: formatRoom(c.hostel_block, c.room_number),
        email: c.email,
      })),
    ],
    [users, customers]
  );

  // The account explicitly chosen from the dropdown. This is what disambiguates
  // an app user from a walk-in of the same name; typing alone can't.
  const [picked, setPicked] = useState<Account | null>(null);

  // Live suggestions across both directories, matched on name, phone or email.
  const accountMatches = useMemo(() => {
    const q = customer.name.trim().toLowerCase();
    if (!q) return [];
    return accounts
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.phone.toLowerCase().includes(q) ||
          (a.email ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [accounts, customer.name]);

  // Who this order bills to: the explicit pick when the name still matches it,
  // else an exact (case-insensitive) name hit. Walk-ins win a tie so typing a
  // saved customer's name keeps behaving as it always has — to charge an app
  // user of the same name, pick them from the dropdown.
  const matchedAccount = useMemo(() => {
    const q = customer.name.trim().toLowerCase();
    if (!q) return undefined;
    if (picked && picked.name.trim().toLowerCase() === q) return picked;
    return (
      accounts.find((a) => a.kind === "customer" && a.name.toLowerCase() === q) ??
      accounts.find((a) => a.name.toLowerCase() === q)
    );
  }, [accounts, customer.name, picked]);

  function pickAccount(a: Account) {
    setCustomer({ name: a.name, phone: a.phone, room: a.room });
    setPicked(a);
  }
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  // Goods handed over but payment not collected yet (e.g. UPI/server down) —
  // the order completes but stays "Unpaid" until marked paid on the orders page.
  const [paymentPending, setPaymentPending] = useState(false);
  // When payment is pending, how much the customer paid up front (blank = none).
  const [paidNow, setPaidNow] = useState("");
  // Split payment: how much of the total was paid in cash (UPI = total − cash).
  const [cashAmount, setCashAmount] = useState("");
  // "Pay by credit": how much of the order to draw from the wallet (blank = use
  // the most it can cover); the rest is the shortfall collected by cash/UPI/split.
  const [walletUse, setWalletUse] = useState("");
  const [shortfallMethod, setShortfallMethod] = useState<"cash" | "upi" | "split">("cash");
  const [shortfallCash, setShortfallCash] = useState("");
  // Cash physically received for a cash order — if it's more than the total and
  // there's no change to give, the excess is parked in the customer's wallet.
  const [cashReceived, setCashReceived] = useState("");
  // Same idea for the cash leg of a credit shortfall: cash handed over above the
  // shortfall (no change given) is parked in the customer's wallet.
  const [shortfallCashReceived, setShortfallCashReceived] = useState("");
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

  function setQtyValue(id: string, value: string) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.product.id !== id) return l;
        const n = Math.max(1, Math.min(Math.floor(Number(value) || 1), l.product.current_stock));
        return { ...l, quantity: n };
      })
    );
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const fee = orderType === "delivery" ? deliveryFee : 0;
  const total = subtotal + fee;

  // Split payment: cash is clamped to [0, total]; UPI is the remainder.
  const cashPaid = Math.min(Math.max(Number(cashAmount) || 0, 0), total);
  const upiPaid = Math.max(total - cashPaid, 0);

  // Store credit can only pay for a known account (their wallet). Balance comes
  // from the directory; an unsaved name has no wallet to charge.
  const creditBalance = matchedAccount ? balances[matchedAccount.id] ?? 0 : 0;
  // How much of the order the wallet can cover at most.
  const maxWallet = Math.min(creditBalance, total);
  // Admin can use up to that — defaults to the max (blank = use max), but may use
  // less and pay more by cash/UPI. Anything not on the wallet is the shortfall.
  const walletPortion =
    payment === "credit"
      ? walletUse.trim() === ""
        ? maxWallet
        : Math.min(Math.max(Number(walletUse) || 0, 0), maxWallet)
      : 0;
  const shortfall = payment === "credit" ? Math.max(total - walletPortion, 0) : 0;
  const shortfallCashPaid =
    shortfallMethod === "cash"
      ? shortfall
      : shortfallMethod === "upi"
        ? 0
        : Math.min(Math.max(Number(shortfallCash) || 0, 0), shortfall);
  const shortfallUpiPaid = Math.max(shortfall - shortfallCashPaid, 0);
  // Pay-by-credit requires a known account (to have a wallet) and some balance.
  const creditUsable = payment !== "credit" || (!!matchedAccount && creditBalance > 0);

  // Cash overpayment → wallet (no change to give). Applies to a cash order, or to
  // the cash leg of a credit shortfall — the excess is parked in the wallet.
  const cashGiven = Math.max(Number(cashReceived) || 0, 0);
  const shortfallCashGiven = Math.max(Number(shortfallCashReceived) || 0, 0);
  const overpay =
    payment === "cash"
      ? cashGiven > total
        ? cashGiven - total
        : 0
      : payment === "credit" && shortfallMethod === "cash" && shortfallCashGiven > shortfall
        ? shortfallCashGiven - shortfall
        : 0;

  // Credit shortfall: how much of it was actually collected at the counter. The
  // cash leg is driven by "Cash received" — blank means the full shortfall was
  // handed over; less leaves a pending balance the customer still owes (the
  // wallet portion is always collected). UPI/split shortfalls settle on the spot.
  const shortfallCollected =
    payment === "credit"
      ? shortfallMethod === "cash"
        ? shortfallCashReceived.trim() === ""
          ? shortfall
          : Math.min(shortfallCashGiven, shortfall)
        : shortfall
      : 0;
  // What's been collected now (wallet debit + collected shortfall) and what's left
  // pending. The wallet is debited regardless; only the uncollected cash is owed.
  const creditPaidNow = payment === "credit" ? walletPortion + shortfallCollected : 0;
  const creditPending = payment === "credit" ? Math.max(total - creditPaidNow, 0) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) return toast.error("Add at least one product.");
    if (!customer.name.trim()) return toast.error("Customer name is required.");
    if (orderType === "delivery" && !customer.room.trim())
      return toast.error("Room is required for delivery.");
    if (payment === "credit" && !matchedAccount) {
      return toast.error("Pick a saved customer or app user to pay by credit.");
    }

    setSaving(true);
    const res = await createManualOrderAction({
      items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity, unit_price: l.unitPrice })),
      order_type: orderType,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_room: customer.room,
      // Billing an app user ties the order to their account, so it shows in their
      // order history and any later settlement lands on their profile wallet.
      ...(matchedAccount?.kind === "user" ? { user_id: matchedAccount.id } : {}),
      payment_method: payment,
      ...(payment === "split" ? { paid_cash: cashPaid, paid_upi: upiPaid } : {}),
      // Pay by credit: wallet covers `walletPortion`, the shortfall is collected
      // now as cash/UPI (recorded in paid_cash/paid_upi; wallet = total − those).
      ...(payment === "credit" && matchedAccount
        ? {
            credit_owner:
              matchedAccount.kind === "user"
                ? { profileId: matchedAccount.id }
                : { customerId: matchedAccount.id },
            paid_cash: shortfallCashPaid,
            paid_upi: shortfallUpiPaid,
            // Wallet portion is always collected; the cash shortfall may be only
            // partly handed over now — the rest stays pending on the order.
            amount_paid: creditPaidNow,
          }
        : {}),
      // Credit orders are settled from the wallet — never "payment pending".
      payment_pending: payment === "credit" ? false : paymentPending,
      ...(payment !== "credit" && paymentPending
        ? { amount_paid: Math.min(Math.max(Number(paidNow) || 0, 0), total) }
        : {}),
      ...(overpay > 0 ? { overpay_to_wallet: overpay } : {}),
      notes,
    });
    setSaving(false);
    if (!res.ok || !res.order) return toast.error(res.error ?? "Failed to create order.");
    setLines([]);
    setQuery("");
    setCustomer({ name: "", phone: "", room: "" });
    setPicked(null);
    setPayment("cash");
    setPaymentPending(false);
    setPaidNow("");
    setCashAmount("");
    setWalletUse("");
    setShortfallMethod("cash");
    setShortfallCash("");
    setCashReceived("");
    setShortfallCashReceived("");
    setNotes("");
    setOrderType("pickup");
    toast.success(
      `Order ${res.order.order_number} completed` +
        (paymentPending && payment !== "credit" ? " · payment pending" : "") +
        (creditPending > 0 ? ` · ${formatCurrency(creditPending, currency)} pending` : "") +
        (overpay > 0 ? ` · ${formatCurrency(overpay, currency)} added to wallet` : "")
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
              onChange={(e) => {
                setQuery(e.target.value);
                setProductActive(0);
              }}
              onKeyDown={(e) => {
                if (!results.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setProductActive((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setProductActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const p = results[productActive];
                  if (p && p.current_stock > 0) add(p);
                } else if (e.key === "Escape") {
                  setQuery("");
                }
              }}
              placeholder="Search products to add…"
              className={`h-10 w-full rounded-lg border pl-9 pr-3 text-sm ${inputTheme}`}
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/15 bg-white text-black shadow-xl dark:border-white/15 dark:bg-stone-900 dark:text-white">
                {results.map((p, i) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => add(p)}
                    onMouseEnter={() => setProductActive(i)}
                    disabled={p.current_stock <= 0}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm text-stone-700 hover:bg-black/5 dark:text-stone-200 dark:hover:bg-white/10 disabled:opacity-40 ${
                      i === productActive ? "bg-black/5 dark:bg-white/10" : ""
                    }`}
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
                  <input
                    type="number"
                    min={1}
                    max={l.product.current_stock}
                    value={l.quantity}
                    onChange={(e) => setQtyValue(l.product.id, e.target.value)}
                    className={`h-7 w-14 rounded-md px-1 text-center text-sm font-bold ${inputTheme}`}
                    aria-label="Quantity"
                  />
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
            <div>
              <Label className="text-stone-700 dark:text-stone-300">Name</Label>
              <Autocomplete
                required
                value={customer.name}
                onChange={(v) => setCustomer((c) => ({ ...c, name: v }))}
                items={accountMatches}
                getKey={(a) => `${a.kind}:${a.id}`}
                getLabel={(a) => a.name}
                onPick={pickAccount}
                renderRight={(a) =>
                  `${a.kind === "user" ? "App user" : "Walk-in"}${a.phone ? ` · ${a.phone}` : ""}`
                }
                placeholder="Type a name, phone or email…"
                inputClassName={inputTheme}
              />
              {matchedAccount && (
                <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  {matchedAccount.kind === "user"
                    ? "Billed to their app account"
                    : "Merges with saved customer"}
                  {matchedAccount.phone ? ` · ${matchedAccount.phone}` : ""}
                </p>
              )}
              {matchedAccount && (
                <span
                  className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    creditBalance > 0
                      ? "border-lime-500/40 bg-lime-50 text-lime-800 dark:bg-lime-400/10 dark:text-lime-300"
                      : creditBalance < 0
                        ? "border-amber-400/40 bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300"
                        : "border-black/10 text-stone-500 dark:border-white/10 dark:text-stone-400"
                  }`}
                >
                  <WalletIcon className="h-3.5 w-3.5" />
                  {creditBalance < 0
                    ? `Owes ${formatCurrency(Math.abs(creditBalance), currency)}`
                    : `Wallet credit: ${formatCurrency(creditBalance, currency)}`}
                </span>
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
                <option value="credit">Pay by credit (wallet)</option>
              </Select>
            </div>
            {payment === "credit" && (
              <div className="space-y-3">
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    !matchedAccount
                      ? "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300"
                      : "border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-400/10 dark:text-lime-300"
                  }`}
                >
                  {!matchedAccount ? (
                    "Pick a saved customer or app user from the name field to charge their wallet."
                  ) : (
                    <>
                      Wallet balance {formatCurrency(creditBalance, currency)} · using{" "}
                      {formatCurrency(walletPortion, currency)}
                      {shortfall > 0 && ` · collect ${formatCurrency(shortfall, currency)} more`}
                    </>
                  )}
                </div>
                {matchedAccount && maxWallet > 0 && (
                  <div>
                    <Label className="text-stone-700 dark:text-stone-300">
                      Use from wallet ({currency}) — max {formatCurrency(maxWallet, currency)}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max={maxWallet}
                      step="0.01"
                      value={walletUse}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") return setWalletUse("");
                        const n = Math.min(Math.max(Number(v) || 0, 0), maxWallet);
                        setWalletUse(String(n));
                      }}
                      placeholder={`${maxWallet}`}
                      className={inputTheme}
                    />
                  </div>
                )}
                {matchedAccount && shortfall > 0 && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-stone-700 dark:text-stone-300">
                        Collect {formatCurrency(shortfall, currency)} shortfall by
                      </Label>
                      <Select
                        value={shortfallMethod}
                        onChange={(e) => setShortfallMethod(e.target.value as "cash" | "upi" | "split")}
                        className={inputTheme}
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="split">Split (Cash + UPI)</option>
                      </Select>
                    </div>
                    {shortfallMethod === "split" && (
                      <div>
                        <Label className="text-stone-700 dark:text-stone-300">Shortfall by cash ({currency}) — rest UPI</Label>
                        <Input
                          type="number"
                          min="0"
                          max={shortfall}
                          step="0.01"
                          value={shortfallCash}
                          onChange={(e) => setShortfallCash(e.target.value)}
                          placeholder="0"
                          className={inputTheme}
                        />
                      </div>
                    )}
                    {shortfallMethod === "cash" && (
                      <div>
                        <Label className="text-stone-700 dark:text-stone-300">Cash received ({currency}) — optional</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={shortfallCashReceived}
                          onChange={(e) => setShortfallCashReceived(e.target.value)}
                          placeholder={`${shortfall}`}
                          className={inputTheme}
                        />
                        {overpay > 0 && (
                          <p className="mt-1.5 text-xs text-lime-600 dark:text-lime-400">
                            No change? {formatCurrency(overpay, currency)} will be added to {matchedAccount.name}&apos;s wallet.
                          </p>
                        )}
                        {creditPending > 0 && (
                          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                            Collected less than the shortfall — {formatCurrency(creditPending, currency)} stays
                            pending (mark it paid later from the Orders page).
                          </p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Wallet {formatCurrency(walletPortion, currency)} · Cash{" "}
                      {formatCurrency(shortfallCashPaid, currency)} · UPI{" "}
                      {formatCurrency(shortfallUpiPaid, currency)} of {formatCurrency(total, currency)}
                    </p>
                  </div>
                )}
              </div>
            )}
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
            {payment === "cash" && (
              <div>
                <Label className="text-stone-700 dark:text-stone-300">Cash received ({currency}) — optional</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder={`${total}`}
                  className={inputTheme}
                />
                {overpay > 0 && (
                  <p className="mt-1.5 text-xs text-lime-600 dark:text-lime-400">
                    No change? {formatCurrency(overpay, currency)} will be added to{" "}
                    {matchedAccount ? matchedAccount.name : customer.name.trim() || "the customer"}&apos;s wallet.
                  </p>
                )}
              </div>
            )}
            {payment !== "credit" && (
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
            )}
            {payment !== "credit" && paymentPending && (
              <div>
                <Label className="text-stone-700 dark:text-stone-300">Paid now ({currency}) — optional</Label>
                <Input
                  type="number"
                  min="0"
                  max={total}
                  step="0.01"
                  value={paidNow}
                  onChange={(e) => setPaidNow(e.target.value)}
                  placeholder="0"
                  className={inputTheme}
                />
                <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                  Paid {formatCurrency(Math.min(Math.max(Number(paidNow) || 0, 0), total), currency)} ·{" "}
                  Pending {formatCurrency(Math.max(total - (Number(paidNow) || 0), 0), currency)} of{" "}
                  {formatCurrency(total, currency)}
                </p>
              </div>
            )}
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

        <Button type="submit" loading={saving} disabled={!creditUsable} variant="dark" className="w-full">
          {payment === "credit"
            ? shortfall > 0
              ? `Complete · ${formatCurrency(walletPortion, currency)} credit + ${formatCurrency(shortfall, currency)}`
              : "Complete Order · Pay by credit"
            : "Complete Order"}
        </Button>
      </div>
    </form>
  );
}
