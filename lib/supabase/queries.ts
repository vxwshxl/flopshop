import { createClient } from "@/lib/supabase/server";
import { settingsToMap, DEFAULT_SETTINGS } from "@/lib/utils/settings";
import type { Profile, SettingsMap } from "@/lib/types";

/** Current auth user's profile (server). Returns null if signed out. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile | null) ?? null;
}

/** All shop settings as a flat key→value map (server). */
export async function getSettings(): Promise<SettingsMap> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("key, value");
  return { ...DEFAULT_SETTINGS, ...settingsToMap(data) };
}
