import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { AdminRealtime } from "@/components/admin/AdminRealtime";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { Navbar, type NavUser } from "@/components/store/Navbar";
import { SettingsProvider } from "@/lib/hooks/useSettings";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const settings = await getSettings();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let navUser: NavUser | null = null;
  if (user) {
    const m = user.user_metadata ?? {};
    navUser = {
      email: user.email ?? null,
      name: (m.full_name as string) || (m.name as string) || null,
      avatarUrl: (m.avatar_url as string) || (m.picture as string) || null,
    };
  }

  return (
    <SettingsProvider initial={settings}>
      <div className="organic-bg flex min-h-screen flex-col text-stone-900 dark:text-stone-100">
        <AdminRealtime />
        <Navbar shopName={settings.shop_name} user={navUser} role={profile.role as Role} showMobileMenu={true} isAdminMode={true} />
        <div className="flex flex-1 min-w-0">
          <Sidebar shopName={settings.shop_name} />
          <main className="flex-1 min-w-0 md:pl-[220px]">
            <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
          </main>
        </div>
      </div>
    </SettingsProvider>
  );
}
