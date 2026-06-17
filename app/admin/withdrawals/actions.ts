"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Role, Withdrawal } from "@/lib/types";

async function requireAdmin(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return ((data?.role ?? "user") as Role) === "admin" ? { id: user.id } : null;
}

type WithdrawalInput = {
  date: string;
  amount: number | string;
  method: "cash" | "upi";
  purpose?: string;
  note?: string;
};

function validate(input: WithdrawalInput): { date: string; amount: number; method: "cash" | "upi" } | string {
  const date = input.date?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a valid date.";
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be greater than 0.";
  const method = input.method === "cash" ? "cash" : "upi";
  return { date, amount: Number(amount.toFixed(2)), method };
}

export async function addWithdrawalAction(
  input: WithdrawalInput
): Promise<{ ok: true; withdrawal: Withdrawal } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const v = validate(input);
  if (typeof v === "string") return { ok: false, error: v };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("withdrawals")
    .insert({
      date: v.date,
      amount: v.amount,
      method: v.method,
      purpose: input.purpose?.trim() || null,
      note: input.note?.trim() || null,
      created_by: actor.id,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/withdrawals");
  return { ok: true, withdrawal: data as Withdrawal };
}

export async function updateWithdrawalAction(
  input: WithdrawalInput & { id: string }
): Promise<{ ok: true; withdrawal: Withdrawal } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const v = validate(input);
  if (typeof v === "string") return { ok: false, error: v };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("withdrawals")
    .update({
      date: v.date,
      amount: v.amount,
      method: v.method,
      purpose: input.purpose?.trim() || null,
      note: input.note?.trim() || null,
    })
    .eq("id", input.id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/withdrawals");
  return { ok: true, withdrawal: data as Withdrawal };
}

export async function deleteWithdrawalAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("withdrawals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/withdrawals");
  return { ok: true };
}
