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

/**
 * Merge duplicate customer records (case variants, typos) into one. The chosen
 * `primaryId` is kept; the rest are deleted. Any field the primary is missing
 * (phone/room/hostel/email) is backfilled from a duplicate, and past order
 * snapshots that used a duplicate's name are re-pointed to the primary's name
 * so the customer's history groups under a single spelling.
 */
export async function mergeCustomersAction(primaryId: string, duplicateIds: string[]) {
  if (!primaryId) return { ok: false, error: "Pick a customer to keep." };
  const ids = [...new Set(duplicateIds)].filter((id) => id && id !== primaryId);
  if (ids.length === 0) return { ok: false, error: "Select at least one duplicate to merge." };

  const admin = createAdminClient();
  const { data: rows, error: fetchErr } = await admin
    .from("customers")
    .select("*")
    .in("id", [primaryId, ...ids]);
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const primary = (rows ?? []).find((r) => r.id === primaryId) as Customer | undefined;
  const dupes = (rows ?? []).filter((r) => r.id !== primaryId) as Customer[];
  if (!primary) return { ok: false, error: "Customer to keep was not found." };

  // Backfill blank fields on the primary from the duplicates (first non-empty).
  const patch: Record<string, string> = {};
  const backfill = (current: string | null, key: "phone" | "room_number" | "hostel_block" | "email") => {
    if (current?.trim()) return;
    const found = dupes.map((d) => d[key]).find((v) => v?.trim());
    if (found) patch[key] = found.trim();
  };
  backfill(primary.phone, "phone");
  backfill(primary.room_number, "room_number");
  backfill(primary.hostel_block, "hostel_block");
  backfill(primary.email, "email");
  if (Object.keys(patch).length) {
    await admin
      .from("customers")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", primaryId);
  }

  // Re-point historical order snapshots (matched by the exact stored names) to
  // the primary's name so reports/search group this customer together.
  const names = [...new Set([primary.name, ...dupes.map((d) => d.name)])];
  await admin.from("orders").update({ customer_name: primary.name }).in("customer_name", names);

  // Remove the merged duplicate rows.
  const { error: delErr } = await admin.from("customers").delete().in("id", ids);
  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath("/admin/customers");
  revalidatePath("/admin/orders/new");
  revalidatePath("/admin/orders");
  return { ok: true, mergedCount: ids.length };
}
