import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { AdminRealtime } from "@/components/admin/AdminRealtime";
import { getAuthUser, getCurrentProfile, getSettings, toNavUser } from "@/lib/supabase/queries";
import { Navbar } from "@/components/store/Navbar";
import { SettingsProvider } from "@/lib/hooks/useSettings";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const [settings, navUser] = await Promise.all([getSettings(), getAuthUser().then(toNavUser)]);

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
