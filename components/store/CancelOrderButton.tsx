"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cancelMyOrderAction } from "@/app/(store)/orders/actions";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function confirmCancel() {
    startTransition(async () => {
      const res = await cancelMyOrderAction(orderId);
      if (!res.ok) {
        toast.error(res.error ?? "Could not cancel order.");
        return;
      }
      toast.success("Order cancelled");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Cancel order
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Cancel this order?">
        <p className="mb-4 text-sm text-stone-600 dark:text-white/70">
          This will cancel your order and release the items back to stock. This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Keep order
          </Button>
          <Button variant="danger" onClick={confirmCancel} loading={pending}>
            Yes, cancel
          </Button>
        </div>
      </Modal>
    </>
  );
}
