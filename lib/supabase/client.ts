"use client";

import { createBrowserClient } from "@supabase/ssr";

// A SINGLE browser client for the whole app. Calling createBrowserClient on
// every hook/component spawns multiple GoTrueClient instances that fight over
// the same `navigator.locks` auth-token lock — which deadlocks `getUser()` and
// any query needing the auth header (stuck checkout, empty hostels, the profile
// popup never evaluating). Memoizing on the window object fixes all of those at once,
// even when Next.js splits code into multiple chunks in production.

export function createClient() {
  if (typeof window === "undefined") {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  if (!(window as any)._supabaseBrowserClient) {
    (window as any)._supabaseBrowserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return (window as any)._supabaseBrowserClient;
}
