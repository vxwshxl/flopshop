"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { AdminCard } from "@/components/admin/StatCard";
import { formatCurrency, toISODate } from "@/lib/utils/formatters";
import type { Product, Supplier } from "@/lib/types";

const inputDark = "border-[#333] bg-[#0a0a0a] text-white focus:border-indigo-500";

export function PurchaseForm({ products, suppliers }: { products: Product[]; suppliers: Supplier[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    product_id: products[0]?.id ?? "",
    quantity: "1",
    unit_price: "",
    supplier: "",
    purchase_date: toISODate(new Date()),
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const product = products.find((p) => p.id === form.product_id);
  const totalCost = useMemo(
    () => (Number(form.quantity) || 0) * (Number(form.unit_price) || 0),
    [form.quantity, form.unit_price]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return toast.error("Select a product.");
    const qty = parseInt(form.quantity);
    if (!qty || qty <= 0) return toast.error("Quantity must be positive.");

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: pErr } = await supabase.from("purchases").insert({
      product_id: product.id,
      product_name: product.name,
      quantity: qty,
      unit_price: Number(form.unit_price) || 0,
      total_cost: totalCost,
      supplier: form.supplier || null,
      purchase_date: form.purchase_date,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    });

    if (pErr) {
      setSaving(false);
      return toast.error(pErr.message);
    }

    // Increase stock atomically.
    const { error: sErr } = await supabase.rpc("adjust_stock", {
      p_product_id: product.id,
      p_delta: qty,
    });
    setSaving(false);
    if (sErr) return toast.error(`Purchase saved, but stock update failed: ${sErr.message}`);

    toast.success(`Added ${qty} to ${product.name} stock`);
    router.push("/admin/purchases");
    router.refresh();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-3">
      <AdminCard title="Purchase Details" className="lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-gray-300">Product</Label>
            <Select value={form.product_id} onChange={set("product_id")} className={inputDark} required>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (stock: {p.current_stock})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-gray-300">Quantity</Label>
            <Input type="number" min="1" required value={form.quantity} onChange={set("quantity")} className={inputDark} />
          </div>
          <div>
            <Label className="text-gray-300">Unit cost (₹)</Label>
            <Input type="number" step="0.01" min="0" required value={form.unit_price} onChange={set("unit_price")} className={inputDark} />
          </div>
          <div>
            <Label className="text-gray-300">Supplier</Label>
            {suppliers.length > 0 ? (
              <Select value={form.supplier} onChange={set("supplier")} className={inputDark}>
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="rounded-lg border border-[#333] bg-[#0a0a0a] px-3 py-2 text-xs text-gray-500">
                No suppliers yet. Add them under{" "}
                <Link href="/admin/suppliers" className="text-indigo-400 underline">
                  Suppliers
                </Link>
                .
              </p>
            )}
          </div>
          <div>
            <Label className="text-gray-300">Purchase date</Label>
            <DatePicker value={form.purchase_date} onChange={(v) => setForm((f) => ({ ...f, purchase_date: v }))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-gray-300">Notes</Label>
            <Textarea value={form.notes} onChange={set("notes")} className={inputDark} rows={2} />
          </div>
        </div>
      </AdminCard>

      <div className="space-y-4">
        <AdminCard title="Summary">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Product</span>
              <span className="text-white">{product?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>New stock</span>
              <span className="text-white">
                {(product?.current_stock ?? 0) + (parseInt(form.quantity) || 0)}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#222] pt-2 text-base font-bold text-white">
              <span>Total cost</span>
              <span>{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </AdminCard>
        <Button type="submit" loading={saving} variant="dark" className="w-full">
          Save purchase & restock
        </Button>
      </div>
    </form>
  );
}
