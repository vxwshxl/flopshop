"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { transferCredit } from "@/lib/server/wallet";

/**
 * A logged-in user sends store credit from their own wallet to another user,
 * looked up by email. The sender can't overdraw (allowNegative stays FALSE) and
 * can't send to themselves. Records the sender as the actor on both ledger legs.
 */
export async function transferCreditAction(
  recipientEmail: string,
  amount: number,
  note?: string
): Promise<{ ok: true; balance: number; recipient: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "Enter an amount greater than 0." };

  const email = recipientEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Enter the recipient's email." };

  const admin = createAdminClient();
  const { data: recipient } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email)
    .maybeSingle();
  if (!recipient) return { ok: false, error: "No user found with that email." };
  if (recipient.id === user.id) return { ok: false, error: "You can't send credit to yourself." };

  const res = await transferCredit({
    fromOwner: { profileId: user.id },
    toOwner: { profileId: recipient.id },
    amount: amt,
    actorId: user.id,
    note: note?.toString().trim() || null,
    allowNegative: false,
  });
  if (!res.ok) return res;

  revalidatePath("/profile");
  return { ok: true, balance: res.fromBalance, recipient: recipient.full_name ?? recipient.email ?? email };
}
