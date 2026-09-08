"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Category } from "@/lib/types";

/**
 * Quick-create for a category, opened from a category picker when the one
 * needed doesn't exist yet — so a missing category is fixed where it's
 * noticed rather than on the Categories page and back again.
 *
 * Name, icon and parent are all it asks for; colour and sort order take
 * sensible defaults that the Categories page can refine later.
 */
export function CategoryCreateModal({
  open,
  initialName,
  categories,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialName: string;
  categories: Category[];
  onClose: () => void;
  onCreated: (category: Category) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="New category">
      {/* Unmounts with the modal, so each open starts from the typed name. */}
      <CategoryFields
        initialName={initialName}
        categories={categories}
        onClose={onClose}
        onCreated={onCreated}
      />
    </Modal>
  );
}

function CategoryFields({
  initialName,
  categories,
  onClose,
  onCreated,
}: {
  initialName: string;
  categories: Category[];
  onClose: () => void;
  onCreated: (category: Category) => void;
}) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState("📦");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);

  // One level deep is all the shop needs, and it makes a cycle impossible —
  // the same rule the Categories page applies.
  const parents = categories.filter((c) => !c.parent_id);
  const slug = slugify(name);
  const clash = categories.find((c) => c.slug === slug);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return toast.error("Give the category a name.");
    if (clash) return toast.error(`“${clash.name}” already uses that name.`);
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: name.trim(),
        slug,
        icon: icon.trim() || "📦",
        color: "#facc15",
        // Lands at the end of the list; the Categories page reorders.
        sort_order: Math.max(0, ...categories.map((c) => c.sort_order)) + 1,
        is_active: true,
        parent_id: parentId || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`“${data.name}” created`);
    onCreated(data as Category);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex gap-3">
        <div className="w-20 shrink-0">
          <Label>Icon</Label>
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={4}
            aria-label="Category icon"
            className="text-center text-lg"
          />
        </div>
        <div className="flex-1">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fizzy Drinks"
            autoFocus
            required
          />
        </div>
      </div>

      <div>
        <Label>Sits under</Label>
        <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Top level — its own section</option>
          {parents.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-white/40">
          {parentId
            ? "Products filed here also count towards the parent, in the shop and in reports."
            : "Top-level categories get their own button in the shop."}
        </p>
      </div>

      {clash && (
        <p className="text-xs text-amber-400/80">
          “{clash.name}” already uses that name — pick another, or use it instead.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} disabled={!slug || !!clash}>
          Create
        </Button>
      </div>
    </form>
  );
}
