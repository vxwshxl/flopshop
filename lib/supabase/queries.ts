import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { settingsToMap, DEFAULT_SETTINGS } from "@/lib/utils/settings";
import type { Hostel, Profile, SettingsMap } from "@/lib/types";

/**
 * Everything here is wrapped in React's `cache()`, which memoizes per *server
 * request*. A single page render walks layout → page → nested components, and
 * each of those used to re-run `getSettings()` / `getCurrentProfile()` /
 * `auth.getUser()` on its own — an admin page fired three auth round-trips and
 * two settings queries for one navigation. With `cache()` the first call in a
 * request does the work and every later call in that render reuses it. Nothing
 * is shared across requests, so per-user data stays per-user.
 */

/** Active hostels (server). Fetched server-side so the dropdown never depends
 *  on a flaky client query. */
export const getActiveHostels = cache(async (): Promise<Hostel[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hostels")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return (data as Hostel[] | null) ?? [];
});

/** The current auth user (server). `auth.getUser()` is a network call to the
 *  Supabase auth server, so it's the one most worth deduping. */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Current auth user's profile (server). Returns null if signed out. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile | null) ?? null;
});

/** All shop settings as a flat key→value map (server). */
export const getSettings = cache(async (): Promise<SettingsMap> => {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("key, value");
  return { ...DEFAULT_SETTINGS, ...settingsToMap(data) };
});

/** What the navbar needs out of an auth user. The same OAuth-metadata
 *  unwrapping was copy-pasted into all three layouts. */
export interface NavUserInfo {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export function toNavUser(user: User | null): NavUserInfo | null {
  if (!user) return null;
  const m = user.user_metadata ?? {};
  return {
    email: user.email ?? null,
    name: (m.full_name as string) || (m.name as string) || null,
    avatarUrl: (m.avatar_url as string) || (m.picture as string) || null,
  };
}
