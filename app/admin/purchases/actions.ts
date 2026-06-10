"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return ((data?.role ?? "user") as Role) === "admin";
}

export interface PurchaseEdit {
  quantity: number;
  unit_price: number;
  supplier?: string | null;
  purchase_date: string;
  notes?: string | null;
}

/**
 * Edits a purchase. If the quantity changes, stock is adjusted by the delta so
 * inventory stays honest. The product's weighted-average cost is intentionally
 * NOT recomputed (historical cost stays put — same policy as everywhere else).
 */
export async function updatePurchaseAction(id: string, edit: PurchaseEdit) {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };
  const admin = createAdminClient();

  const { data: old, error: loadErr } = await admin
    .from("purchases")
    .select("product_id, quantity")
    .eq("id", id)
    .single();
  if (loadErr || !old) return { ok: false, error: loadErr?.message ?? "Purchase not found." };

  const qty = Math.max(1, Math.floor(edit.quantity));
  const unit = Math.max(0, Number(edit.unit_price) || 0);

  const { error: updErr } = await admin
    .from("purchases")
    .update({
      quantity: qty,
      unit_price: unit,
      total_cost: qty * unit,
      supplier: edit.supplier?.trim() || null,
      purchase_date: edit.purchase_date,
      notes: edit.notes?.trim() || null,
    })
    .eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };

  // Apply the stock difference (new qty − old qty).
  const delta = qty - Number(old.quantity);
  if (delta !== 0 && old.product_id) {
    await admin.rpc("adjust_stock", { p_product_id: old.product_id, p_delta: delta });
  }

  revalidatePath("/admin/purchases");
  return { ok: true };
}

/** Deletes a purchase and removes the stock it had added. */
export async function deletePurchaseAction(id: string) {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };
  const admin = createAdminClient();

  const { data: row, error: loadErr } = await admin
    .from("purchases")
    .select("product_id, quantity")
    .eq("id", id)
    .single();
  if (loadErr || !row) return { ok: false, error: loadErr?.message ?? "Purchase not found." };

  const { error: delErr } = await admin.from("purchases").delete().eq("id", id);
  if (delErr) return { ok: false, error: delErr.message };

  if (row.product_id) {
    await admin.rpc("adjust_stock", { p_product_id: row.product_id, p_delta: -Number(row.quantity) });
  }

  revalidatePath("/admin/purchases");
  return { ok: true };
}
