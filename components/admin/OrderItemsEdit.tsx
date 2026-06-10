"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EditOrderItemsModal } from "@/components/admin/EditOrderItemsModal";
import type { Order, Product } from "@/lib/types";

type PickerProduct = Pick<Product, "id" | "name" | "selling_price">;

/** "Edit" button (for the Items card header) + the edit-items modal. */
export function OrderItemsEdit({ order, products }: { order: Order; products: PickerProduct[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Nothing to edit on a cancelled or empty order.
  if (order.status === "cancelled" || (order.order_items?.length ?? 0) === 0) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && (
        <EditOrderItemsModal
          order={order}
          products={products}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
