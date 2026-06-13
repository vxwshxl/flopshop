import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * User-initiated wallet top-up request. This is NOT a payment gateway — the user
 * states how much they paid (cash/UPI) and an admin verifies & approves it
 * manually, which actually credits their wallet.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { amount, method, reference } = body as {
    amount?: number;
    method?: string;
    reference?: string;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: "Enter an amount greater than 0." }, { status: 400 });
  }
  if (method !== "cash" && method !== "upi") {
    return NextResponse.json({ error: "Choose how you paid (cash or UPI)." }, { status: 400 });
  }

  const { error } = await supabase.from("wallet_topup_requests").insert({
    profile_id: user.id,
    amount: amt,
    method,
    reference: reference?.toString().trim() || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
