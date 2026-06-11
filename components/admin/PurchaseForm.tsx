"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { createSupplierAction } from "@/app/admin/suppliers/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { AdminCard } from "@/components/admin/StatCard";
import { formatCurrency, toISODate } from "@/lib/utils/formatters";
import type { Product, Supplier } from "@/lib/types";

const inputDark = "border-[#333] bg-[#0a0a0a] text-white focus:border-indigo-500";
const stepperBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#333] bg-[#0a0a0a] text-white transition hover:bg-white/10";

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
  // Supplier autocomplete: dropdown visibility + keyboard-highlighted row.
  const [supplierFocused, setSupplierFocused] = useState(false);
  const [supplierActive, setSupplierActive] = useState(0);

  const product = products.find((p) => p.id === form.product_id);
  const totalCost = useMemo(
    () => (Number(form.quantity) || 0) * (Number(form.unit_price) || 0),
    [form.quantity, form.unit_price]
  );

  // Live suggestions from the saved supplier directory.
  const supplierMatches = useMemo(() => {
    const q = form.supplier.trim().toLowerCase();
    if (!q) return [];
    return suppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6);
  }, [suppliers, form.supplier]);

  // Exact (case-insensitive) hit — typing this won't create a new supplier.
  const matchedSupplier = useMemo(() => {
    const q = form.supplier.trim().toLowerCase();
    return q ? suppliers.find((s) => s.name.toLowerCase() === q) : undefined;
  }, [suppliers, form.supplier]);

  function pickSupplier(s: Supplier) {
    setForm((f) => ({ ...f, supplier: s.name }));
    setSupplierFocused(false);
  }

  // Increment/decrement a numeric field via the +/- buttons.
  function bump(key: "quantity" | "unit_price", delta: number) {
    setForm((f) => {
      const cur = Number(f[key]) || 0;
      const next =
        key === "quantity"
          ? Math.max(1, Math.floor(cur + delta))
          : Math.max(0, Math.round((cur + delta) * 100) / 100);
      return { ...f, [key]: String(next) };
    });
  }

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

    // A typed-in supplier that isn't on record yet gets saved to the Suppliers
    // table so it shows up in the dropdown next time.
    const supplierName = form.supplier.trim();
    if (supplierName && !matchedSupplier) {
      await createSupplierAction(supplierName);
    }

    const { error: pErr } = await supabase.from("purchases").insert({
      product_id: product.id,
      product_name: product.name,
      quantity: qty,
      unit_price: Number(form.unit_price) || 0,
      total_cost: totalCost,
      supplier: supplierName || null,
      purchase_date: form.purchase_date,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    });

    if (pErr) {
      setSaving(false);
      return toast.error(pErr.message);
    }

    // Add stock and roll the product's cost into a weighted moving average.
    const { error: sErr } = await supabase.rpc("record_purchase_cost", {
      p_product_id: product.id,
      p_qty: qty,
      p_unit_cost: Number(form.unit_price) || 0,
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
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => bump("quantity", -1)} aria-label="Decrease quantity" className={stepperBtn}>
                <Minus className="h-4 w-4" />
              </button>
              <Input type="number" min="1" required value={form.quantity} onChange={set("quantity")} className={`${inputDark} text-center`} />
              <button type="button" onClick={() => bump("quantity", 1)} aria-label="Increase quantity" className={stepperBtn}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <Label className="text-gray-300">Unit cost (₹)</Label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => bump("unit_price", -1)} aria-label="Decrease unit cost" className={stepperBtn}>
                <Minus className="h-4 w-4" />
              </button>
              <Input type="number" step="0.01" min="0" required value={form.unit_price} onChange={set("unit_price")} className={`${inputDark} text-center`} />
              <button type="button" onClick={() => bump("unit_price", 1)} aria-label="Increase unit cost" className={stepperBtn}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Label className="text-gray-300">Supplier</Label>
            <Input
              value={form.supplier}
              onChange={(e) => {
                set("supplier")(e);
                setSupplierActive(0);
              }}
              onKeyDown={(e) => {
                if (!supplierFocused || supplierMatches.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSupplierActive((i) => Math.min(i + 1, supplierMatches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSupplierActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const s = supplierMatches[supplierActive];
                  if (s) pickSupplier(s);
                } else if (e.key === "Escape") {
                  setSupplierFocused(false);
                }
              }}
              onFocus={() => setSupplierFocused(true)}
              // Delay so a click on a suggestion registers before it closes.
              onBlur={() => setTimeout(() => setSupplierFocused(false), 150)}
              placeholder="Type a supplier…"
              autoComplete="off"
              className={inputDark}
            />
            {supplierFocused && supplierMatches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#333] bg-[#1a1a1a] text-white shadow-xl">
                {supplierMatches.map((s, i) => (
                  <button
                    type="button"
                    key={s.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSupplier(s)}
                    onMouseEnter={() => setSupplierActive(i)}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10 ${
                      i === supplierActive ? "bg-white/10" : ""
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {form.supplier.trim() && !matchedSupplier && (
              <p className="mt-1.5 text-xs text-emerald-400">New supplier — saved on purchase.</p>
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
