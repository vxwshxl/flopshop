"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

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

/**
 * Client-side current auth user (Google metadata).
 *
 * Deliberately does NOT fetch the DB profile: every page that needs profile
 * fields already renders them server-side (`getCurrentProfile()`), so fetching
 * it here again was a second round-trip whose result nothing read.
 */
export function useUser() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUser(authUser ? toInfo(authUser) : null);
      setLoading(false);
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

  return { user, loading, isAuthenticated: !!user };
}
