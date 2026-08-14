"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import {
  cancelDeliveryOrderAction,
  releaseDeliveryOrderAction,
} from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Order } from "@/lib/types";

type Mode = "release" | "cancel";

/** Ready-made reasons — a partner on a bike shouldn't have to type. */
const REASONS: Record<Mode, string[]> = {
  release: ["Not free right now", "Too far from me", "Vehicle trouble", "Ending my shift"],
  cancel: ["Everything is out of stock", "Customer not reachable", "Customer refused the order", "Wrong address"],
};

/**
 * The two ways out of an order a partner has already claimed, kept apart on
 * purpose: giving it back costs the customer nothing and is the one we push
 * them towards, while cancelling ends their order and is worded so nobody picks
 * it by accident.
 */
export function CantDeliverModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const canSubmit = mode === "release" || reason.trim().length >= 3;

  function submit() {
    if (!mode) return;
    startTransition(async () => {
      try {
        const res =
          mode === "release"
            ? await releaseDeliveryOrderAction(order.id, reason)
            : await cancelDeliveryOrderAction(order.id, reason);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't update the order.");
          return;
        }
        toast.success(
          mode === "release"
            ? "Order handed back — another partner can claim it."
            : "Order cancelled · customer notified"
        );
        onClose();
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Modal open onClose={onClose} title="Can't deliver this order?">
      {!mode ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-400">
            {order.order_number} · {order.customer_name}
          </p>

          <button
            type="button"
            onClick={() => setMode("release")}
            className="flex w-full items-start gap-3 rounded-xl border border-white/10 p-3.5 text-left transition hover:border-lime-400/40 hover:bg-white/5"
          >
            <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />
            <span className="min-w-0">
              <span className="block font-semibold text-white">Give it back</span>
              <span className="block text-sm text-stone-400">
                You can&apos;t take it — the order stays alive and goes back to the pool for
                another partner to claim.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("cancel")}
            className="flex w-full items-start gap-3 rounded-xl border border-white/10 p-3.5 text-left transition hover:border-red-500/40 hover:bg-red-500/5"
          >
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <span className="min-w-0">
              <span className="block font-semibold text-white">Cancel the order</span>
              <span className="block text-sm text-stone-400">
                Nothing on it can be delivered at all. {order.customer_name} is notified, stock
                goes back and anything paid is refunded.
              </span>
            </span>
          </button>

          <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-stone-500">
            Only some items missing? Close this and use <strong className="text-stone-400">Out of
            stock</strong> instead — it keeps the rest of the order.
          </p>

          <Button variant="outline" className="mt-1 w-full" onClick={onClose}>
            Never mind
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-stone-400">
            {mode === "release"
              ? "Tell the shop why you're handing it back (optional)."
              : `Why is ${order.customer_name}'s order being cancelled? They'll see this.`}
          </p>

          <div className="flex flex-wrap gap-2">
            {REASONS[mode].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  reason === r
                    ? "border-lime-400 bg-lime-400/15 text-lime-300"
                    : "border-white/15 text-stone-400 hover:bg-white/5"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === "release" ? "Optional note…" : "Reason for cancelling…"}
            maxLength={200}
          />

          {mode === "cancel" && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
              This ends the order for good. It can&apos;t be undone from here.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMode(null)}
              disabled={pending}
            >
              Back
            </Button>
            <Button className="w-full" onClick={submit} disabled={pending || !canSubmit}>
              {mode === "release" ? "Hand it back" : "Cancel order"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
