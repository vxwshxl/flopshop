"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import type { Supplier } from "@/lib/types";

export async function createSupplierAction(name: string) {
  const admin = createAdminClient();

  if (!name?.trim()) {
    return { ok: false, error: "Supplier name is required." };
  }

  const { data, error } = await admin
    .from("suppliers")
    .insert({ name: name.trim(), is_active: true })
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/purchases/new");
  return { ok: true, supplier: data as Supplier };
}

export async function deleteSupplierAction(id: string) {
  const admin = createAdminClient();

  const { error } = await admin.from("suppliers").delete().eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/purchases/new");
  return { ok: true };
}

export async function updateSupplierAction(id: string, name: string, is_active: boolean) {
  const admin = createAdminClient();
  if (!name?.trim()) return { ok: false, error: "Supplier name is required." };

  const { data, error } = await admin
    .from("suppliers")
    .update({ name: name.trim(), is_active })
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/purchases/new");
  return { ok: true, supplier: data as Supplier };
}
