import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { AdminRealtime } from "@/components/admin/AdminRealtime";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const settings = await getSettings();

  return (
    <div className="organic-bg min-h-screen text-stone-900 dark:text-stone-100">
      <AdminRealtime />
      <Sidebar shopName={settings.shop_name} />
      <main className="md:pl-[220px]">
        <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
