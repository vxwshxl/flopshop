"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import type { Hostel, Role } from "@/lib/types";

async function requireAdmin(): Promise<string | null> {
  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.admin.getUserById("");
  if (!user) return null;

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user.id : null;
}

export async function createHostelAction(name: string) {
  const admin = createAdminClient();
  
  if (!name?.trim()) {
    return { ok: false, error: "Hostel name is required." };
  }

  const { data, error } = await admin
    .from("hostels")
    .insert({ name: name.trim(), is_active: true })
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/hostels");
  return { ok: true, hostel: data as Hostel };
}

export async function deleteHostelAction(id: string) {
  const admin = createAdminClient();

  const { error } = await admin.from("hostels").delete().eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/hostels");
  return { ok: true };
}
