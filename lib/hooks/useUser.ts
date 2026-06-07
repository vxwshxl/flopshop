"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export interface UserInfo {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

function toInfo(user: User): UserInfo {
  const m = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    name: (m.full_name as string) || (m.name as string) || null,
    avatarUrl: (m.avatar_url as string) || (m.picture as string) || null,
  };
}

/** Client-side current auth user (Google metadata) + DB profile (for role). */
export function useUser() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!authUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setUser(toInfo(authUser));
      setLoading(false);
      // Profile (role etc.) is best-effort — auth state does not depend on it.
      const { data } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
      if (active) setProfile((data as Profile | null) ?? null);
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading, isAuthenticated: !!user };
}
