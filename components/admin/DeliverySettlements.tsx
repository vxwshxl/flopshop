"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { HandCoins, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { settleDeliveryPartnerAction } from "@/app/admin/delivery/actions";

export type PendingSettlement = {
  partnerId: string;
  name: string;
  orderCount: number;
  cashToCollect: number;
  upiPayout: number;
  net: number;
};

export type SettlementHistoryRow = {
  id: string;
  name: string;
  order_count: number;
  net_amount: number;
  created_at: string;
  confirmed: boolean;
  confirmed_at: string | null;
};

/** Net direction phrased for the admin. */
function netLabel(net: number, currency: string) {
  if (net > 0) return { text: `Partner pays shop ${formatCurrency(net, currency)}`, cls: "text-lime-400" };
  if (net < 0) return { text: `Shop pays partner ${formatCurrency(-net, currency)}`, cls: "text-amber-400" };
  return { text: "Settled — nothing owed", cls: "text-stone-400" };
}

export function DeliverySettlements({
  pending,
  history,
  currency,
}: {
  pending: PendingSettlement[];
  history: SettlementHistoryRow[];
  currency: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function settle(partnerId: string) {
    startTransition(async () => {
      const res = await settleDeliveryPartnerAction(partnerId);
      if (!res.ok) {
        toast.error(res.error ?? "Could not settle.");
        return;
      }
      toast.success("Marked settled — awaiting partner confirmation");
      router.refresh();
    });
  }

  return (
    <div className="glass mt-4 rounded-2xl">
      <div className="glass-line flex items-center gap-2 border-b px-4 py-3">
        <HandCoins className="h-4 w-4 text-yellow-400" />
        <h3 className="text-sm font-bold text-stone-900 dark:text-white">Partner Settlements</h3>
      </div>

      <div className="space-y-4 p-4">
        {/* Pending — what's owed right now, with a Settle up button per partner. */}
        {pending.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing to settle — all delivered orders are reconciled.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((p) => {
              const nl = netLabel(p.net, currency);
              return (
                <div key={p.partnerId} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-stone-900 dark:text-white">{p.name}</p>
                    <span className="text-xs text-stone-500">{p.orderCount} orders</span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <div className="flex justify-between">
                      <span>Cash held (owes shop)</span>
                      <span className="text-stone-700 dark:text-stone-200">{formatCurrency(p.cashToCollect, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>UPI payout (shop owes)</span>
                      <span className="text-stone-700 dark:text-stone-200">{formatCurrency(p.upiPayout, currency)}</span>
                    </div>
                  </div>
                  <div className={`mt-2 border-t border-black/10 pt-2 text-sm font-bold dark:border-white/10 ${nl.cls}`}>
                    {nl.text}
                  </div>
                  <Button size="sm" className="mt-3 w-full" disabled={busy} onClick={() => settle(p.partnerId)}>
                    Settle up
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* History — recent batches and whether the partner has confirmed. */}
        {history.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Recent settlements</p>
            <div className="space-y-2">
              {history.map((h) => {
                const nl = netLabel(Number(h.net_amount), currency);
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                  >
                    <div>
                      <p className="font-medium text-stone-900 dark:text-white">{h.name}</p>
                      <p className="text-xs text-stone-500">
                        {h.order_count} orders · {formatDateTime(h.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${nl.cls}`}>{nl.text}</p>
                      {h.confirmed ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-lime-500">
                          <CheckCircle2 className="h-3 w-3" /> Confirmed{" "}
                          {h.confirmed_at ? formatDateTime(h.confirmed_at) : ""}
                        </p>
                      ) : (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-500">
                          <Clock className="h-3 w-3" /> Awaiting confirmation
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
