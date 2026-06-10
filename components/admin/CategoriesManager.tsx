"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/admin/StatCard";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tablePageClass, tableCardClass, stickyHead } from "@/components/admin/TableShell";
import { useTableControls, byText, byNum } from "@/lib/hooks/useTableControls";
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
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", icon: "📦", color: "#facc15", sort_order: "0", is_active: true });
  const ctl = useTableControls(categories, {
    searchFields: (c) => [c.name, c.slug],
    sorters: {
      order: byNum((c) => c.sort_order),
      name: byText((c) => c.name),
      products: byNum((c) => counts[c.id] ?? 0),
    },
    initialSort: "order",
    initialDir: "asc",
  });
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(ctl.rows);

  function openNew() {
    setEditing(null);
    setForm({ name: "", icon: "📦", color: "#facc15", sort_order: String(categories.length + 1), is_active: true });
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
    setDeleteTarget(c);
  }

  async function removeConfirmed() {
    if (!deleteTarget) return;
    const c = deleteTarget;
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    setDeleteTarget(null);
    if (error) return toast.error(error.message);
    toast.success("Category deleted");
    router.refresh();
  }

  return (
    <div className={tablePageClass}>
      <PageHeader
        title="Categories"
        subtitle={<span className="hidden lg:inline">{categories.length} categories</span>}
        action={
          <Button variant="dark" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add category
          </Button>
        }
      />

      <div className={tableCardClass}>
        <div className="shrink-0">
          <TableToolbar query={ctl.query} onQuery={ctl.setQuery} placeholder="Search category…" showDateRange={false} />
        </div>

        <TableScroll>
        <table className="w-full text-sm">
          <thead className={stickyHead}>
            <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
              <SortHeader label="Order" sortKey="order" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
              <SortHeader label="Category" sortKey="name" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
              <th className="p-3">Slug</th>
              <SortHeader label="Products" sortKey="products" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-black/75 dark:text-white/75">
            {pageItems.map((c) => (
              <tr
                key={c.id}
                onClick={() => openEdit(c)}
                className="cursor-pointer border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10"
              >
                <td className="p-3 text-black/50 dark:text-white/50">
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-3 w-3" /> {c.sort_order}
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-yellow-400 bg-yellow-400 px-2.5 py-0.5 font-medium text-black"
                  >
                    {c.icon} {c.name}
                  </span>
                </td>
                <td className="p-3 text-black/50 dark:text-white/50">{c.slug}</td>
                <td className="p-3">{counts[c.id] ?? 0}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    c.is_active
                      ? "border border-yellow-400 bg-yellow-400 text-black"
                      : "border border-black/15 text-black/50 dark:border-white/15 dark:text-white/50"
                  }`}>
                    {c.is_active ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <button onClick={() => remove(c)} className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
        <div className="shrink-0">
          <Pagination page={page} totalPages={totalPages} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />
        </div>
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
                className="h-10 w-full rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-black"
              />
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-black/75 dark:text-white/75">
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
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete category"
        description={`Delete "${deleteTarget?.name ?? "this category"}"?`}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeConfirmed}
      />
    </div>
  );
}
