"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/types";

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string | null;
  room_number?: string | null;
  hostel_block?: string | null;
}

function validate(input: CustomerInput) {
  if (!input.name?.trim()) return "Customer name is required.";
  if (!input.phone?.trim()) return "Phone number is required.";
  return null;
}

function payload(input: CustomerInput) {
  return {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    room_number: input.room_number?.trim() || null,
    hostel_block: input.hostel_block?.trim() || null,
  };
}

export async function createCustomerAction(input: CustomerInput) {
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const admin = createAdminClient();
  const { data, error } = await admin.from("customers").insert(payload(input)).select().single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/customers");
  revalidatePath("/admin/orders/new");
  return { ok: true, customer: data as Customer };
}

export async function updateCustomerAction(id: string, input: CustomerInput) {
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customers")
    .update(payload(input))
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/customers");
  revalidatePath("/admin/orders/new");
  return { ok: true, customer: data as Customer };
}

export async function deleteCustomerAction(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("customers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/customers");
  revalidatePath("/admin/orders/new");
  return { ok: true };
}
