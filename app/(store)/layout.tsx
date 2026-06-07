import { Navbar, type NavUser } from "@/components/store/Navbar";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const isOpen = settings.shop_is_open !== "false";

  // Resolve the signed-in user server-side (the auth cookie is HttpOnly, so the
  // browser can't read it — the navbar must be told who is logged in).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let navUser: NavUser | null = null;
  let role: Role | null = null;
  if (user) {
    const m = user.user_metadata ?? {};
    navUser = {
      email: user.email ?? null,
      name: (m.full_name as string) || (m.name as string) || null,
      avatarUrl: (m.avatar_url as string) || (m.picture as string) || null,
    };
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = (profile?.role as Role) ?? "user";
  }

  return (
    <div className="organic-bg min-h-screen">
      <Navbar shopName={settings.shop_name} isOpen={isOpen} user={navUser} role={role} />
      {children}
    </div>
  );
}
