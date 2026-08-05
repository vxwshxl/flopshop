"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Minus, Trash2, Search, ChevronDown, Wallet as WalletIcon } from "lucide-react";
import toast from "react-hot-toast";
import { createManualOrderAction } from "@/app/admin/orders/actions";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Autocomplete } from "@/components/ui/autocomplete";
import { formatCurrency } from "@/lib/utils/formatters";
import { deliverySplit } from "@/lib/utils/orderHelpers";
import { imagePositionStyle } from "@/lib/utils/image";
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
  // Product picker menu. With no query it lists every in-stock item (opened by
  // the chevron or by focusing the field); typing narrows it.
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);
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

  // ── Payment ──────────────────────────────────────────────────────────────────
  // Three independent amount fields. Clicking a method button pre-fills the
  // full order total into that field (zeroing the other two) — but any field
  // can be freely adjusted afterwards for any split combination.
  const [cashIn, setCashIn] = useState("");
  const [upiIn, setUpiIn] = useState("");
  const [creditIn, setCreditIn] = useState("");

  // Payment pending: goods handed over but payment not yet collected.
  const [paymentPending, setPaymentPending] = useState(false);
  // When pending, how much was paid now (blank = nothing upfront).
  const [paidNow, setPaidNow] = useState("");

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Typing searches everything (out-of-stock rows still show, disabled); with an
  // empty box the menu lists the full in-stock catalogue.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
    return products.filter((p) => p.current_stock > 0);
  }, [products, query]);

  const showResults = pickerOpen && results.length > 0;

  // Close the picker on an outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [pickerOpen]);

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
    setPickerOpen(false);
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
  // Mirrors createOrder's split so the total quoted here is the total saved —
  // including the free-delivery promo when the basket qualifies.
  const fee = deliverySplit(settings, orderType, subtotal).delivery_fee;
  const freeDelivery = orderType === "delivery" && fee === 0 && deliveryFee > 0;
  const total = subtotal + fee;

  // Wallet info for the matched customer.
  const creditBalance = matchedAccount ? balances[matchedAccount.id] ?? 0 : 0;
  const maxCredit = Math.min(creditBalance, total);

  // Parse the three amount fields (floor at 0).
  const cashNum = Math.max(Number(cashIn) || 0, 0);
  const upiNum = Math.max(Number(upiIn) || 0, 0);
  // Credit is also capped by the wallet balance (can't spend what you don't have).
  const creditNum = Math.min(Math.max(Number(creditIn) || 0, 0), creditBalance);

  const totalCollected = cashNum + upiNum + creditNum;

  // Overpay in cash → park excess in wallet (no change given).
  const overpay = cashIn.trim() !== "" && cashNum > total - upiNum - creditNum
    ? Math.max(cashNum - (total - upiNum - creditNum), 0)
    : 0;

  // Derive the stored payment_method from what's been filled in.
  const hasCash = cashNum > 0;
  const hasUpi = upiNum > 0;
  const hasCredit = creditNum > 0;
  const derivedMethod: PaymentMethod = hasCredit
    ? "credit"
    : hasCash && hasUpi
      ? "split"
      : hasUpi
        ? "upi"
        : "cash";

  // Credit requires a linked account.
  const creditUsable = !hasCredit || (!!matchedAccount && creditBalance > 0);

  /** Pre-fill one method's field with the full total, zeroing the others. */
  function pickMethod(m: "cash" | "upi" | "credit") {
    if (m === "cash") { setCashIn(String(total)); setUpiIn(""); setCreditIn(""); }
    if (m === "upi")  { setUpiIn(String(total));  setCashIn(""); setCreditIn(""); }
    if (m === "credit") {
      const fillCredit = Math.min(creditBalance, total);
      setCreditIn(String(fillCredit > 0 ? fillCredit : 0));
      setCashIn("");
      setUpiIn("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) return toast.error("Add at least one product.");
    if (!customer.name.trim()) return toast.error("Customer name is required.");
    if (orderType === "delivery" && !customer.room.trim())
      return toast.error("Room is required for delivery.");
    if (hasCredit && !matchedAccount)
      return toast.error("Pick a saved customer or app user to pay by credit.");
    if (hasCredit && creditNum > creditBalance)
      return toast.error(`Wallet only has ${formatCurrency(creditBalance, currency)}.`);

    setSaving(true);

    // For credit orders the wallet covers (total − cash − upi).
    // paid_cash / paid_upi record the non-wallet legs.
    const paidCash = derivedMethod === "credit" ? cashNum : derivedMethod === "split" ? cashNum : 0;
    const paidUpi  = derivedMethod === "credit" ? upiNum  : derivedMethod === "split" ? upiNum  : 0;

    const res = await createManualOrderAction({
      items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity, unit_price: l.unitPrice })),
      order_type: orderType,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_room: customer.room,
      // Billing an app user ties the order to their account.
      ...(matchedAccount?.kind === "user" ? { user_id: matchedAccount.id } : {}),
      payment_method: derivedMethod,
      // Split breakdown (cash + UPI, no credit).
      ...(derivedMethod === "split" ? { paid_cash: cashNum, paid_upi: upiNum } : {}),
      // Credit: wallet covers the difference; cash/UPI are the upfront legs.
      ...(derivedMethod === "credit" && matchedAccount
        ? {
            credit_owner:
              matchedAccount.kind === "user"
                ? { profileId: matchedAccount.id }
                : { customerId: matchedAccount.id },
            paid_cash: paidCash,
            paid_upi: paidUpi,
            // Full amount collected (wallet is always debited on the spot).
            amount_paid: total,
          }
        : {}),
      // Credit orders are always paid on the spot — no pending state.
      payment_pending: hasCredit ? false : paymentPending,
      ...(!hasCredit && paymentPending
        ? { amount_paid: Math.min(Math.max(Number(paidNow) || 0, 0), total) }
        : {}),
      ...(overpay > 0 ? { overpay_to_wallet: overpay } : {}),
      notes,
    });

    setSaving(false);
    if (!res.ok || !res.order) return toast.error(res.error ?? "Failed to create order.");

    // Reset all fields.
    setLines([]);
    setQuery("");
    setCustomer({ name: "", phone: "", room: "" });
    setPicked(null);
    setCashIn("");
    setUpiIn("");
    setCreditIn("");
    setPaymentPending(false);
    setPaidNow("");
    setNotes("");
    setOrderType("pickup");

    const creditDeducted = creditNum;
    toast.success(
      `Order ${res.order.order_number} completed` +
        (paymentPending && !hasCredit ? " · payment pending" : "") +
        (creditDeducted > 0 ? ` · ${formatCurrency(creditDeducted, currency)} deducted from wallet` : "") +
        (overpay > 0 ? ` · ${formatCurrency(overpay, currency)} added to wallet` : "")
    );
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <AdminCard title="Add Products">
          <div className="relative" ref={pickerRef}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
            <input
              ref={queryRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setProductActive(0);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  setPickerOpen(false);
                  return;
                }
                if (e.key === "ArrowDown" && !pickerOpen) {
                  e.preventDefault();
                  setPickerOpen(true);
                  setProductActive(0);
                  return;
                }
                if (!showResults) return;
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
                }
              }}
              placeholder="Search products to add…"
              className={`h-10 w-full rounded-lg border pl-9 pr-11 text-sm ${inputTheme}`}
            />
            <button
              type="button"
              aria-label={pickerOpen ? "Hide product list" : "Show all in-stock products"}
              aria-expanded={pickerOpen}
              onClick={() => {
                setProductActive(0);
                setPickerOpen((o) => !o);
                queryRef.current?.focus();
              }}
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-stone-500 transition hover:bg-black/5 dark:text-stone-400 dark:hover:bg-white/10"
            >
              <ChevronDown className={`h-4 w-4 transition ${pickerOpen ? "rotate-180" : ""}`} />
            </button>
            {showResults && (
              <div className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-black/15 bg-white text-black shadow-xl dark:border-white/15 dark:bg-stone-900 dark:text-white">
                {results.map((p, i) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => add(p)}
                    onMouseEnter={() => setProductActive(i)}
                    disabled={p.current_stock <= 0}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-stone-700 hover:bg-black/5 dark:text-stone-200 dark:hover:bg-white/10 disabled:opacity-40 ${
                      i === productActive ? "bg-black/5 dark:bg-white/10" : ""
                    }`}
                  >
                    <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-md bg-stone-100 dark:bg-stone-800">
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt=""
                          fill
                          sizes="36px"
                          style={imagePositionStyle(p.details)}
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-base">🍫</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 text-xs text-gray-500">
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
                <option value="delivery">
                  Delivery ({freeDelivery ? "free — promo" : `+${formatCurrency(deliveryFee, currency)}`})
                </option>
              </Select>
            </div>

            {/* ── Payment method buttons ── */}
            <div>
              <Label className="text-stone-700 dark:text-stone-300">Payment method</Label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(["cash", "upi", "credit"] as const).map((m) => {
                  const isActive =
                    m === "cash"   ? hasCash && !hasUpi && !hasCredit :
                    m === "upi"    ? hasUpi  && !hasCash && !hasCredit :
                    hasCredit;
                  const label = m === "cash" ? "Cash" : m === "upi" ? "UPI" : "Credit";
                  const disabled = m === "credit" && (!matchedAccount || creditBalance <= 0);
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      title={m === "credit" && disabled ? "Link a customer with wallet balance to use credit" : undefined}
                      onClick={() => pickMethod(m)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        isActive
                          ? "border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-500"
                          : "border-black/15 bg-white text-stone-700 hover:bg-stone-50 dark:border-white/15 dark:bg-black dark:text-stone-200 dark:hover:bg-white/5"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {matchedAccount && creditBalance > 0 && (
                <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                  Wallet: {formatCurrency(creditBalance, currency)} available
                </p>
              )}
            </div>

            {/* ── Three amount fields — always visible ── */}
            <div className="space-y-3">
              <div>
                <Label className="text-stone-700 dark:text-stone-300">
                  Cash received ({currency})
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashIn}
                  onChange={(e) => setCashIn(e.target.value)}
                  placeholder={hasCash || (!hasUpi && !hasCredit) ? `${total}` : "0"}
                  className={inputTheme}
                />
              </div>

              <div>
                <Label className="text-stone-700 dark:text-stone-300">
                  UPI received ({currency})
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={upiIn}
                  onChange={(e) => setUpiIn(e.target.value)}
                  placeholder="0"
                  className={inputTheme}
                />
              </div>

              <div>
                <Label className={`text-stone-700 dark:text-stone-300 ${!matchedAccount ? "opacity-50" : ""}`}>
                  Credit received ({currency})
                  {matchedAccount && maxCredit > 0 && (
                    <span className="ml-1 font-normal text-stone-500 dark:text-stone-400">
                      — max {formatCurrency(maxCredit, currency)}
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={creditBalance > 0 ? creditBalance : undefined}
                  step="0.01"
                  value={creditIn}
                  onChange={(e) => setCreditIn(e.target.value)}
                  placeholder="0"
                  disabled={!matchedAccount || creditBalance <= 0}
                  className={`${inputTheme} disabled:opacity-40`}
                />
                {!matchedAccount && (
                  <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                    Link a customer to enable wallet deduction.
                  </p>
                )}
              </div>
            </div>

            {/* ── Breakdown hint ── */}
            {(hasCash || hasUpi || hasCredit) && (
              <div className="rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-xs text-stone-600 dark:border-white/10 dark:bg-white/5 dark:text-stone-300">
                {hasCash && <span>Cash {formatCurrency(cashNum, currency)}</span>}
                {hasCash && (hasUpi || hasCredit) && <span className="mx-1 opacity-40">+</span>}
                {hasUpi && <span>UPI {formatCurrency(upiNum, currency)}</span>}
                {hasUpi && hasCredit && <span className="mx-1 opacity-40">+</span>}
                {hasCredit && <span>Wallet {formatCurrency(creditNum, currency)}</span>}
                <span className="mx-1 opacity-40">=</span>
                <span className={totalCollected < total ? "text-amber-600 dark:text-amber-400" : totalCollected > total ? "text-lime-600 dark:text-lime-400" : "font-semibold"}>
                  {formatCurrency(totalCollected, currency)}
                </span>
                {totalCollected < total && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                    ({formatCurrency(total - totalCollected, currency)} short)
                  </span>
                )}
                {overpay > 0 && (
                  <span className="ml-1 text-lime-600 dark:text-lime-400">
                    · {formatCurrency(overpay, currency)} → wallet
                  </span>
                )}
              </div>
            )}

            {/* Payment pending (non-credit only) */}
            {!hasCredit && (
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
            {!hasCredit && paymentPending && (
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
            <div className="num-row text-stone-600 dark:text-stone-400">
              <span>Subtotal</span>
              <span className="text-stone-950 dark:text-white">{formatCurrency(subtotal, currency)}</span>
            </div>
            {orderType === "delivery" && (
              <div className="num-row text-stone-600 dark:text-stone-400">
                <span>Delivery fee</span>
                {freeDelivery ? (
                  <span className="font-semibold text-lime-600 dark:text-lime-400">FREE</span>
                ) : (
                  <span className="text-stone-950 dark:text-white">{formatCurrency(fee, currency)}</span>
                )}
              </div>
            )}
            {freeDelivery && (
              <p className="break-words text-xs text-stone-500 dark:text-stone-400">
                Promo — the shop still pays the partner {formatCurrency(Number(settings.delivery_person_share ?? 8), currency)}.
              </p>
            )}
            <div className="num-row border-t border-black/10 pt-2 text-base font-bold text-stone-950 dark:border-white/10 dark:text-white">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </AdminCard>

        <Button type="submit" loading={saving} disabled={!creditUsable} variant="dark" className="w-full">
          {hasCredit
            ? `Complete · ${formatCurrency(creditNum, currency)} wallet${cashNum > 0 ? ` + ${formatCurrency(cashNum, currency)} cash` : ""}${upiNum > 0 ? ` + ${formatCurrency(upiNum, currency)} UPI` : ""}`
            : "Complete Order"}
        </Button>
      </div>
    </form>
  );
}
