import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client bound to the request cookies.
 * Use inside Server Components, Route Handlers, and Server Actions.
 *
 * `cache()`d so one request gets one client instead of a fresh one per caller
 * (layout, page, and every helper each called this). They're all bound to the
 * same request cookies anyway, and sharing one avoids re-instantiating GoTrue
 * — and its in-memory session — a dozen times per render.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore, middleware refreshes the session.
          }
        },
      },
    }
  );
});

/**
 * Service-role client — bypasses RLS. SERVER ONLY.
 * Used for privileged operations like stock adjustments and reading
 * all profiles for delivery-person assignment.
 */
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  );
}
