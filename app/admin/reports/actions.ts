"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { IncomeMethod, Role } from "@/lib/types";

const METHODS: IncomeMethod[] = ["cash", "upi", "bank", "credit", "other"];

async function requireAdmin(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return ((data?.role ?? "user") as Role) === "admin" ? { id: user.id } : null;
}

/**
 * Create a method transfer. `legs` are the net per-method deltas (negative =
 * source, positive = destination) and must sum to zero with at least one move.
 */
export async function createMethodTransferAction(input: {
  date: string;
  note?: string;
  legs: { method: IncomeMethod; delta: number }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const date = input.date?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick a valid date." };

  // Merge by method and drop zeros.
  const merged = new Map<IncomeMethod, number>();
  for (const leg of input.legs) {
    if (!METHODS.includes(leg.method)) return { ok: false, error: "Invalid payment method." };
    const amt = Number(leg.delta);
    if (!Number.isFinite(amt)) return { ok: false, error: "Invalid amount." };
    merged.set(leg.method, Number(((merged.get(leg.method) ?? 0) + amt).toFixed(2)));
  }
  const legs = [...merged.entries()].filter(([, d]) => d !== 0).map(([method, delta]) => ({ method, delta }));

  if (legs.length < 2) return { ok: false, error: "Pick a source and a destination." };
  const sum = Number(legs.reduce((s, l) => s + l.delta, 0).toFixed(2));
  if (sum !== 0) return { ok: false, error: "Sources and destination must balance." };

  const admin = createAdminClient();
  const { data: transfer, error } = await admin
    .from("method_transfers")
    .insert({ date, note: input.note?.trim() || null, created_by: actor.id })
    .select("id")
    .single();
  if (error || !transfer) return { ok: false, error: error?.message ?? "Failed to create transfer." };

  const { error: legErr } = await admin
    .from("method_transfer_legs")
    .insert(legs.map((l) => ({ transfer_id: transfer.id, method: l.method, delta: l.delta })));
  if (legErr) {
    await admin.from("method_transfers").delete().eq("id", transfer.id);
    return { ok: false, error: legErr.message };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function deleteMethodTransferAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("method_transfers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/reports");
  return { ok: true };
}
