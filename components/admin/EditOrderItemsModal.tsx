"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { updateOrderItemsAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Order, OrderItem, Product } from "@/lib/types";

type PickerProduct = Pick<Product, "id" | "name" | "selling_price">;

type EditRow = {
  /** Stable React key; equals the DB id for existing rows. */
  key: string;
  /** DB id, or null for a not-yet-saved (newly added) line. */
  id: string | null;
  product_id: string | null;
  product_name: string;
  quantity: string;
  unit_price: string;
};

/**
 * Edit an order's line items — swap a flavour, fix qty/price, add or remove a
 * line. Shared by the order detail panel and the orders list (quick edit).
 */
export function EditOrderItemsModal({
  order,
  products,
  onClose,
  onSaved,
}: {
  order: Order;
  products: PickerProduct[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const currency = "₹";
  // Each row carries a stable `key` for React + edits. Existing items keep their
  // DB `id`; new rows have id === null (the server inserts them).
  const [rows, setRows] = useState<EditRow[]>(
    (order.order_items ?? []).map((it: OrderItem) => ({
      key: it.id,
      id: it.id,
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: String(it.quantity),
      unit_price: String(it.unit_price),
    }))
  );
  const [saving, setSaving] = useState(false);

  const set = (key: string, field: "product_name" | "quantity" | "unit_price", value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  // Pick a product from the catalogue: swap the name + product_id and refresh the
  // unit price to that product's selling price (admin can still tweak qty/price).
  const selectProduct = (key: string, productName: string) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const p = products.find((x) => x.name === productName);
        return p
          ? { ...r, product_id: p.id, product_name: p.name, unit_price: String(p.selling_price) }
          : { ...r, product_name: productName };
      })
    );

  // Append a fresh line, defaulting to the first catalogue product.
  const addRow = () => {
    const p = products[0];
    setRows((rs) => [
      ...rs,
      {
        key: `new-${Date.now()}-${rs.length}`,
        id: null,
        product_id: p?.id ?? null,
        product_name: p?.name ?? "",
        quantity: "1",
        unit_price: p ? String(p.selling_price) : "0",
      },
    ]);
  };

  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const total = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0);

  async function save() {
    if (rows.length === 0) return toast.error("Add at least one item.");
    setSaving(true);
    const res = await updateOrderItemsAction(
      order.id,
      rows.map((r) => ({
        id: r.id,
        product_id: r.product_id,
        product_name: r.product_name,
        quantity: Number(r.quantity) || 1,
        unit_price: Number(r.unit_price) || 0,
      }))
    );
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Failed to save.");
    toast.success("Items updated");
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Edit order items">
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="rounded-lg border border-white/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-gray-300">Item</Label>
              <button
                type="button"
                onClick={() => removeRow(r.key)}
                disabled={saving}
                className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
            <Select value={r.product_name} onChange={(e) => selectProduct(r.key, e.target.value)} className="mb-2">
              {!products.some((p) => p.name === r.product_name) && (
                <option value={r.product_name}>{r.product_name}</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">Qty</Label>
                <Input type="number" min="1" value={r.quantity} onChange={(e) => set(r.key, "quantity", e.target.value)} />
              </div>
              <div>
                <Label className="text-gray-300">Unit price ({currency})</Label>
                <Input type="number" min="0" step="0.01" value={r.unit_price} onChange={(e) => set(r.key, "unit_price", e.target.value)} />
              </div>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full" onClick={addRow} disabled={saving || products.length === 0}>
          + Add item
        </Button>
        <p className="text-sm text-gray-400">
          New items total: <span className="font-semibold text-white">{formatCurrency(total, currency)}</span>
          <span className="text-gray-500"> (delivery fee unchanged)</span>
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" className="w-full" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="w-full" onClick={save} disabled={saving}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}
