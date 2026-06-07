"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { AdminCard } from "@/components/admin/StatCard";
import type { Category, Product } from "@/lib/types";

const inputDark =
  "border-[#333] bg-[#0a0a0a] text-white placeholder:text-gray-600 focus:border-indigo-500";

export function ProductForm({
  categories,
  product,
}: {
  categories: Category[];
  product?: Product;
}) {
  const router = useRouter();
  const editing = !!product;
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? categories[0]?.id ?? "",
    cost_price: String(product?.cost_price ?? ""),
    selling_price: String(product?.selling_price ?? ""),
    current_stock: String(product?.current_stock ?? 0),
    minimum_stock: String(product?.minimum_stock ?? 5),
    is_active: product?.is_active ?? true,
  });
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(product?.image_url ?? "");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    let finalImageUrl = imageUrl;

    try {
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        finalImageUrl = data.publicUrl;
        setImageUrl(finalImageUrl);
      }

      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        category_id: form.category_id || null,
        cost_price: Number(form.cost_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        current_stock: parseInt(form.current_stock) || 0,
        minimum_stock: parseInt(form.minimum_stock) || 0,
        image_url: finalImageUrl || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      const { error } = editing
        ? await supabase.from("products").update(payload).eq("id", product!.id)
        : await supabase.from("products").insert(payload);

      if (error) throw error;
      toast.success(editing ? "Product updated" : "Product created");
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <AdminCard title="Details">
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Name</Label>
              <Input required value={form.name} onChange={set("name")} className={inputDark} />
            </div>
            <div>
              <Label className="text-gray-300">Description</Label>
              <Textarea value={form.description} onChange={set("description")} className={inputDark} />
            </div>
            <div>
              <Label className="text-gray-300">Category</Label>
              <Select value={form.category_id} onChange={set("category_id")} className={inputDark}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Pricing & Stock">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Cost price (₹)</Label>
              <Input type="number" step="0.01" min="0" value={form.cost_price} onChange={set("cost_price")} className={inputDark} />
            </div>
            <div>
              <Label className="text-gray-300">Selling price (₹)</Label>
              <Input type="number" step="0.01" min="0" required value={form.selling_price} onChange={set("selling_price")} className={inputDark} />
            </div>
            <div>
              <Label className="text-gray-300">Current stock</Label>
              <Input type="number" min="0" value={form.current_stock} onChange={set("current_stock")} className={inputDark} />
            </div>
            <div>
              <Label className="text-gray-300">Minimum stock</Label>
              <Input type="number" min="0" value={form.minimum_stock} onChange={set("minimum_stock")} className={inputDark} />
            </div>
          </div>
        </AdminCard>
      </div>

      <div className="space-y-4">
        <AdminCard title="Image">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-40 w-40 overflow-hidden rounded-xl border border-[#333] bg-[#0a0a0a]">
              {preview ? (
                <Image src={preview} alt="preview" fill className="object-cover" sizes="160px" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl">📦</div>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#333] px-3 py-2 text-sm text-gray-300 hover:bg-white/5">
              <Upload className="h-4 w-4" /> Upload image
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          </div>
        </AdminCard>

        <AdminCard title="Visibility">
          <label className="flex items-center justify-between text-sm text-gray-300">
            Active (visible in store)
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4"
            />
          </label>
        </AdminCard>

        <Button type="submit" loading={saving} variant="dark" className="w-full">
          {editing ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
