import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { full_name, phone, room_number, hostel_block } = body as {
    full_name?: string | null;
    phone?: string | null;
    room_number?: string | null;
    hostel_block?: string | null;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const updatePayload = {
    ...(full_name !== undefined ? { full_name } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(room_number !== undefined ? { room_number } : {}),
    ...(hostel_block !== undefined ? { hostel_block } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    const admin = createAdminClient();
    const insertPayload = {
      id: user.id,
      email: user.email,
      full_name: full_name ?? (user.user_metadata?.full_name as string | null) ?? null,
      phone: phone ?? null,
      room_number: room_number ?? null,
      hostel_block: hostel_block ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error: insertError } = await admin.from("profiles").insert(insertPayload);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
