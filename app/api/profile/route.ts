import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
    .from("profiles")
    .update({
      ...(full_name !== undefined ? { full_name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(room_number !== undefined ? { room_number } : {}),
      ...(hostel_block !== undefined ? { hostel_block } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
