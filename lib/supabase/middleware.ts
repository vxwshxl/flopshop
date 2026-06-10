import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/lib/types";

/**
 * Refreshes the Supabase auth session and enforces access rules:
 *  - /admin/*               → admin only
 *  - /delivery/*            → delivery or admin
 *  - /orders/*, /checkout   → any authenticated user
 *  - banned users           → redirected to /banned everywhere
 *  - incomplete profiles    → redirected to /profile until phone/room/hostel set
 */
export async function updateSession(request: NextRequest) {
  // Site-wide maintenance switch (ops env var). Serve a friendly 503 on every
  // route except the maintenance page itself.
  if (process.env.MAINTENANCE_MODE === "1" && request.nextUrl.pathname !== "/maintenance") {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.rewrite(url, { status: 503 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAdmin = path.startsWith("/admin");
  const needsDelivery = path.startsWith("/delivery");
  const needsAuth =
    path.startsWith("/orders") || path.startsWith("/checkout") || needsAdmin || needsDelivery;

  const redirectTo = (pathname: string, withRedirectParam = false) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    if (withRedirectParam) url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  };

  if (needsAuth && !user) {
    return redirectTo("/login", true);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, phone, room_number, hostel_block")
      .eq("id", user.id)
      .single();

    const role = (profile?.role ?? "user") as Role;

    // Banned users are walled off to /banned (the sign-out route lives under
    // /auth/* which the proxy matcher excludes, so they can still sign out).
    if (role === "banned") {
      return path === "/banned" ? response : redirectTo("/banned");
    }
    // A non-banned user landing on /banned doesn't belong there.
    if (path === "/banned") return redirectTo("/");

    if (needsAdmin && role !== "admin") return redirectTo("/403");
    if (needsDelivery && role !== "delivery" && role !== "admin") return redirectTo("/403");

    // Profile completion gate: regular customers must fill phone + room + hostel
    // before they can use any page. Staff (admin/delivery) are exempt. API routes
    // are allowed through so the save request itself can complete.
    const profileIncomplete =
      !profile?.phone?.trim() || !profile?.room_number?.trim() || !profile?.hostel_block?.trim();
    const profileExempt = role === "admin" || role === "delivery";
    const profileSafePath = path === "/profile" || path.startsWith("/api");
    if (profileIncomplete && !profileExempt && !profileSafePath) {
      return redirectTo("/profile");
    }
  }

  return response;
}
