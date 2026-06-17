"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { WalletTransaction, WalletTopupRequest, WalletTxnType } from "@/lib/types";

const TXN_LABELS: Record<WalletTxnType, string> = {
  change: "Change credit",
  topup: "Top-up",
  order_payment: "Order payment",
  refund: "Refund",
  adjustment: "Adjustment",
};

/** Store-credit wallet on the user's profile: balance, top-up request, history. */
export function WalletCard({
  balance,
  transactions,
  pendingTopups,
  currency,
}: {
  balance: number;
  transactions: WalletTransaction[];
  pendingTopups: WalletTopupRequest[];
  currency: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "upi">("upi");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function requestTopup(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter an amount greater than 0.");
    setSubmitting(true);
    const res = await fetch("/api/wallet/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt, method, reference }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return toast.error(data.error ?? "Could not submit request.");
    setAmount("");
    setReference("");
    toast.success("Request sent — an admin will verify it shortly.");
    router.refresh();
  }

  return (
    <div>
      <div className="glass space-y-4 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300">
            <WalletIcon className="h-4 w-4" /> Wallet balance
          </span>
          <span className="text-xl font-extrabold text-stone-900 dark:text-white">
            {formatCurrency(balance, currency)}
          </span>
        </div>

        {pendingTopups.length > 0 && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
            {pendingTopups.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> {formatCurrency(Number(t.amount), currency)} via{" "}
                {t.method.toUpperCase()} — awaiting admin approval
              </div>
            ))}
          </div>
        )}

        <form onSubmit={requestTopup} className="space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Add money</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Pay the shop by cash or UPI, then request a top-up — an admin verifies it and credits your wallet.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount ({currency})</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Paid via</Label>
              <Select value={method} onChange={(e) => setMethod(e.target.value as "cash" | "upi")}>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref / note" />
          </div>
          <Button type="submit" loading={submitting} className="w-full">
            Request top-up
          </Button>
        </form>

        {transactions.length > 0 && (
          <div className="border-t border-black/10 pt-4 dark:border-white/10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Recent activity</p>
            <div className="space-y-1.5">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-stone-800 dark:text-stone-100">{TXN_LABELS[t.type]}</p>
                    <p className="text-xs text-stone-500">{formatDateTime(t.created_at)}</p>
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
    </div>
  );
}
