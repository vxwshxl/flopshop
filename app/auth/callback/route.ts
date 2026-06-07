import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeRedirect(redirect: string | null, origin: string) {
  if (!redirect) return "/";
  if (redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;
  try {
    const url = new URL(redirect);
    if (url.origin === origin) return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // fallback to root
  }
  return "/";
}

// Handles the email-confirmation / OAuth code exchange.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = safeRedirect(searchParams.get("redirect"), origin);

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${redirect}`);
}
