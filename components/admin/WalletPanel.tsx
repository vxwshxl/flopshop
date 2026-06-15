"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon, Plus, Minus } from "lucide-react";
import toast from "react-hot-toast";
import { adminAdjustWalletAction } from "@/app/admin/wallet/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { WalletOwner } from "@/lib/server/wallet";
import type { WalletTransaction, WalletTxnType } from "@/lib/types";

const TXN_LABELS: Record<WalletTxnType, string> = {
  change: "Change credit",
  topup: "Top-up",
  order_payment: "Order payment",
  refund: "Refund",
  adjustment: "Adjustment",
};

/**
 * Admin panel to view a wallet balance + history and add/deduct store credit.
 * Works for either a login profile or a walk-in customer (the `owner` decides).
 */
export function WalletPanel({
  owner,
  initialBalance,
  transactions,
  currency,
}: {
  owner: WalletOwner;
  initialBalance: number;
  transactions?: WalletTransaction[];
  currency: string;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [direction, setDirection] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<WalletTxnType>("change");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter an amount greater than 0.");
    const signed = direction === "add" ? amt : -amt;
    setSaving(true);
    const res = await adminAdjustWalletAction(owner, signed, type, note);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setBalance(res.balance);
    setAmount("");
    setNote("");
    toast.success(direction === "add" ? "Credit added." : "Credit deducted.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
          balance < 0
            ? "border-amber-300 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10"
            : "border-black/10 bg-lime-50 dark:border-white/10 dark:bg-lime-400/10"
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-200">
          <WalletIcon className="h-4 w-4" /> {balance < 0 ? "Owed to shop (debt)" : "Wallet balance"}
        </span>
        <span
          className={`text-lg font-extrabold ${
            balance < 0 ? "text-amber-700 dark:text-amber-300" : "text-stone-900 dark:text-white"
          }`}
        >
          {formatCurrency(balance, currency)}
        </span>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection("add")}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
              direction === "add"
                ? "border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-400/10 dark:text-lime-300"
                : "border-black/10 text-stone-600 dark:border-white/10 dark:text-stone-300"
            }`}
          >
            <Plus className="h-4 w-4" /> Add credit
          </button>
          <button
            type="button"
            onClick={() => setDirection("deduct")}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
              direction === "deduct"
                ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300"
                : "border-black/10 text-stone-600 dark:border-white/10 dark:text-stone-300"
            }`}
          >
            <Minus className="h-4 w-4" /> Deduct
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount ({currency})</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Reason</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as WalletTxnType)}>
              <option value="change">No change at counter</option>
              <option value="topup">Cash/UPI top-up</option>
              <option value="adjustment">Manual adjustment</option>
            </Select>
          </div>
        </div>
        <div>
          <Label>Note (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} placeholder="e.g. ₹30 change owed on order" />
        </div>
        <Button type="submit" loading={saving} className="w-full">
          {direction === "add" ? "Add credit" : "Deduct credit"}
        </Button>
      </form>

      {transactions && transactions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Recent activity</p>
          <div className="space-y-1.5">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
              >
                <div>
                  <p className="font-medium text-stone-900 dark:text-white">{TXN_LABELS[t.type]}</p>
                  <p className="text-xs text-stone-500">
                    {formatDateTime(t.created_at)}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </div>
                <span className={`font-semibold ${Number(t.amount) >= 0 ? "text-lime-500" : "text-amber-500"}`}>
                  {Number(t.amount) >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(Number(t.amount)), currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
