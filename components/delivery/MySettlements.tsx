"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { BellRing, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { confirmSettlementAction } from "@/app/admin/delivery/actions";
import type { DeliverySettlement } from "@/lib/types";

/** Phrase the net from the partner's point of view. */
function partnerNet(net: number, currency: string) {
  if (net < 0) return `Shop paid you ${formatCurrency(-net, currency)}`;
  if (net > 0) return `You handed the shop ${formatCurrency(net, currency)}`;
  return "Settled — nothing owed";
}

export function MySettlements({
  settlements,
  currency,
}: {
  settlements: DeliverySettlement[];
  currency: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const pending = settlements.filter((s) => !s.confirmed);
  const recent = settlements.filter((s) => s.confirmed).slice(0, 5);

  if (settlements.length === 0) return null;

  function confirm(id: string) {
    startTransition(async () => {
      const res = await confirmSettlementAction(id);
      if (!res.ok) {
        toast.error(res.error ?? "Could not confirm.");
        return;
      }
      toast.success("Settlement confirmed");
      router.refresh();
    });
  }

  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Settlements</h2>
        {pending.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            <BellRing className="h-3 w-3" /> {pending.length} to confirm
          </span>
        )}
      </div>

      {pending.map((s) => (
        <div key={s.id} className="glass mb-3 rounded-2xl border border-amber-400/30 p-4">
          <p className="text-sm text-stone-400">
            The shop marked a settlement of {s.order_count} order{s.order_count === 1 ? "" : "s"} as paid.
          </p>
          <p className="mt-1 text-lg font-extrabold text-white">{partnerNet(Number(s.net_amount), currency)}</p>
          <p className="mt-0.5 text-xs text-stone-500">Marked {formatDateTime(s.created_at)}</p>
          <Button className="mt-3 w-full" disabled={busy} onClick={() => confirm(s.id)}>
            Confirm
          </Button>
        </div>
      ))}

      {recent.length > 0 && (
        <div className="space-y-2">
          {recent.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-white">{partnerNet(Number(s.net_amount), currency)}</p>
                <p className="text-xs text-stone-500">{s.order_count} orders</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-lime-400">
                <CheckCircle2 className="h-3 w-3" />
                {s.confirmed_at ? formatDateTime(s.confirmed_at) : "Confirmed"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
