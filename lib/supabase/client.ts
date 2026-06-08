"use client";

import { createBrowserClient } from "@supabase/ssr";

// A SINGLE browser client for the whole app. Calling createBrowserClient on
// every hook/component spawns multiple GoTrueClient instances that fight over
// the same `navigator.locks` auth-token lock — which deadlocks `getUser()` and
// any query needing the auth header (stuck checkout, empty hostels, the profile
// popup never evaluating). Memoizing fixes all of those at once.
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
