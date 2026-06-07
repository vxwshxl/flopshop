"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Category } from "@/lib/types";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoriesManager({
  categories,
  counts,
}: {
  categories: Category[];
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "📦", color: "#6366f1", sort_order: "0", is_active: true });

  function openNew() {
    setEditing(null);
    setForm({ name: "", icon: "📦", color: "#6366f1", sort_order: String(categories.length + 1), is_active: true });
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setForm({
      name: c.name,
      icon: c.icon,
      color: c.color,
      sort_order: String(c.sort_order),
      is_active: c.is_active,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: form.name.trim(),
      slug: slugify(form.name),
      icon: form.icon || "📦",
      color: form.color,
      sort_order: parseInt(form.sort_order) || 0,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Category updated" : "Category created");
    setOpen(false);
    router.refresh();
  }

  async function remove(c: Category) {
    if ((counts[c.id] ?? 0) > 0) return toast.error("Move or delete its products first.");
    if (!confirm(`Delete "${c.name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Category deleted");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="dark" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add category
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#222] bg-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#222] text-left text-xs text-gray-500">
              <th className="p-3">Order</th>
              <th className="p-3">Category</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Products</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                <td className="p-3 text-gray-500">
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-3 w-3" /> {c.sort_order}
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 font-medium text-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.icon} {c.name}
                  </span>
                </td>
                <td className="p-3 text-gray-500">{c.slug}</td>
                <td className="p-3">{counts[c.id] ?? 0}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.is_active ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"}`}>
                    {c.is_active ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(c)} className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Category" : "New Category"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Icon (emoji)</Label>
              <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} maxLength={4} />
            </div>
            <div>
              <Label>Color</Label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="h-10 w-full rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
