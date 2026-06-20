"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon, Plus, Minus, ArrowLeftRight, Search } from "lucide-react";
import toast from "react-hot-toast";
import {
  adminAdjustWalletAction,
  adminTransferCreditAction,
  searchWalletOwnersAction,
  type WalletOwnerOption,
} from "@/app/admin/wallet/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { WalletTxnList } from "@/components/wallet/WalletTxnList";
import { formatCurrency } from "@/lib/utils/formatters";
import type { WalletOwner } from "@/lib/server/wallet";
import type { WalletTransactionView, WalletTxnMethod, WalletTxnType } from "@/lib/types";

type Mode = "add" | "deduct" | "transfer";

/**
 * Admin panel to view a wallet balance + history, add/deduct store credit, and
 * transfer it to another user/customer. Works for either a login profile or a
 * walk-in customer (the `owner` decides).
 */
export function WalletPanel({
  owner,
  initialBalance,
  transactions,
  currency,
}: {
  owner: WalletOwner;
  initialBalance: number;
  transactions?: WalletTransactionView[];
  currency: string;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<WalletTxnType>("change");
  const [method, setMethod] = useState<WalletTxnMethod>("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Transfer recipient search.
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState<WalletOwnerOption[]>([]);
  const [recipient, setRecipient] = useState<WalletOwnerOption | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (mode !== "transfer" || recipient) return;
    const q = recipientQuery.trim();
    const seq = ++searchSeq.current;
    const t = setTimeout(
      async () => {
        const res = q.length < 2 ? [] : await searchWalletOwnersAction(q);
        if (seq === searchSeq.current) setRecipientResults(res);
      },
      q.length < 2 ? 0 : 250
    );
    return () => clearTimeout(t);
  }, [recipientQuery, recipient, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter an amount greater than 0.");

    setSaving(true);
    if (mode === "transfer") {
      if (!recipient) {
        setSaving(false);
        return toast.error("Pick a recipient.");
      }
      const toOwner: WalletOwner =
        recipient.kind === "profile" ? { profileId: recipient.id } : { customerId: recipient.id };
      const res = await adminTransferCreditAction(owner, toOwner, amt, note);
      setSaving(false);
      if (!res.ok) return toast.error(res.error);
      setBalance(res.fromBalance);
      resetForm();
      toast.success(`Transferred ${formatCurrency(amt, currency)} to ${recipient.label}.`);
      return router.refresh();
    }

    const signed = mode === "add" ? amt : -amt;
    const res = await adminAdjustWalletAction(owner, signed, type, note, type === "topup" ? method : null);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setBalance(res.balance);
    resetForm();
    toast.success(mode === "add" ? "Credit added." : "Credit deducted.");
    router.refresh();
  }

  function resetForm() {
    setAmount("");
    setNote("");
    setRecipient(null);
    setRecipientQuery("");
    setRecipientResults([]);
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
        <div className="grid grid-cols-3 gap-2">
          <ModeButton active={mode === "add"} onClick={() => setMode("add")} tone="lime">
            <Plus className="h-4 w-4" /> Add
          </ModeButton>
          <ModeButton active={mode === "deduct"} onClick={() => setMode("deduct")} tone="amber">
            <Minus className="h-4 w-4" /> Deduct
          </ModeButton>
          <ModeButton active={mode === "transfer"} onClick={() => setMode("transfer")} tone="indigo">
            <ArrowLeftRight className="h-4 w-4" /> Transfer
          </ModeButton>
        </div>

        {mode === "transfer" ? (
          <div className="space-y-3">
            <div>
              <Label>Send to</Label>
              {recipient ? (
                <div className="flex items-center justify-between rounded-lg border border-indigo-400/40 bg-indigo-50 px-3 py-2 text-sm dark:bg-indigo-400/10">
                  <span className="font-medium text-stone-900 dark:text-white">
                    {recipient.label}
                    {recipient.sublabel ? <span className="ml-1 text-xs text-stone-500">· {recipient.sublabel}</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecipient(null)}
                    className="text-xs font-medium text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    value={recipientQuery}
                    onChange={(e) => setRecipientQuery(e.target.value)}
                    placeholder="Search a user or customer…"
                    className="pl-9"
                  />
                  {recipientResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/15 bg-white text-black shadow-xl dark:border-white/15 dark:bg-stone-900 dark:text-white">
                      {recipientResults.map((r) => (
                        <button
                          type="button"
                          key={`${r.kind}:${r.id}`}
                          onClick={() => {
                            setRecipient(r);
                            setRecipientResults([]);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          <span>{r.label}</span>
                          <span className="text-xs text-stone-500">{r.sublabel ?? r.kind}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label>Amount ({currency})</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
        ) : (
          <>
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
            {type === "topup" && (
              <div>
                <Label>Paid via</Label>
                <Select value={method} onChange={(e) => setMethod(e.target.value as WalletTxnMethod)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank transfer</option>
                  <option value="other">Other</option>
                </Select>
              </div>
            )}
          </>
        )}

        <div>
          <Label>Note (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} placeholder="e.g. ₹30 change owed on order" />
        </div>
        <Button type="submit" loading={saving} className="w-full">
          {mode === "add" ? "Add credit" : mode === "deduct" ? "Deduct credit" : "Transfer credit"}
        </Button>
      </form>

      {transactions && transactions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Credit history</p>
          <WalletTxnList transactions={transactions} currency={currency} />
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "lime" | "amber" | "indigo";
  children: React.ReactNode;
}) {
  const activeCls = {
    lime: "border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-400/10 dark:text-lime-300",
    amber: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300",
    indigo: "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-400/10 dark:text-indigo-300",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
        active ? activeCls : "border-black/10 text-stone-600 dark:border-white/10 dark:text-stone-300"
      }`}
    >
      {children}
    </button>
  );
}
