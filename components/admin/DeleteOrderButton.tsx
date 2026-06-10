"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteOrderAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/**
 * Trash button for the order detail header. Confirms, deletes the order (stock
 * is returned by the server action), then returns to the orders list.
 */
export function DeleteOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await deleteOrderAction(orderId);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to delete");
        return;
      }
      toast.success("Order deleted");
      router.push("/admin/orders");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Delete order"
        className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 text-red-500 transition hover:bg-red-500/10 dark:border-white/10"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete order?">
        <p className="mb-4 text-sm text-gray-300">
          This permanently deletes order <span className="font-semibold text-white">{orderNumber}</span> and its
          items. Any stock it was holding is returned to inventory. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting} loading={deleting}>
            Delete order
          </Button>
        </div>
      </Modal>
    </>
  );
}
